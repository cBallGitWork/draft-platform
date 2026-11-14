import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { everyLeague } from "../shared/cappedRead";
import { isAdmin, teamsOf } from "../shared/leagueAccess";
import { adminByline, eventLetter } from "./letterWords";
import { marking, type TellMoment } from "./letterMoments";
import type { LeagueEvent } from "../schema";
import type { LetterKind, LetterLink } from "./letterShape";
import { isSquadMove } from "../squads/squadPlace";
import { rescoreLive } from "../table/liveRescore";

// Filing Mail's letters (#26, spec/16): the one way any feature puts a letter in someone's Mail.

/** What a letter says, and who wrote it, if someone did (convex/schema/mail.ts, `letterFields`). */
export type Letter = Pick<Doc<"letters">, "subject" | "body" | "from" | "link">;

/** A letter, or one that tells a time, which each reader reads in their own zone (#442, #912). */
type Written = Letter | ((tell: TellMoment) => Letter);

/** `letter` as it is filed: any moment it tells marked, and kept with it (`letterMoments.ts`). */
function filed(letter: Written): Letter & { moments?: number[] } {
  if (typeof letter !== "function") return letter;
  const { tell, moments } = marking();
  const words = letter(tell);
  return moments.length === 0 ? words : { ...words, moments };
}

/** Where a letter of `kind` links when the letter names nowhere of its own (S16.2, S16.8): a trade's
 *  to Trades, a claim's or a drop's to My team's Transactions, a lineup's to Tactics, a position's
 *  to the squad, the draft's to the draft room, a join or a team renamed to the table that lists the
 *  league's teams, a patch to the patch notes. A commissioner's action, an assignment and a scout's
 *  report have none of their own: the filer names one where it shows, or the letter has no link. */
function kindLink(kind: LetterKind): LetterLink | undefined {
  switch (kind) {
    case "trade":
      return { to: "trades" };
    case "waivers":
      return { to: "transactions" };
    case "lineup":
      return { to: "tactics" };
    case "positions":
      return { to: "squad" };
    case "draft":
      return { to: "draft" };
    case "league":
      return { to: "table" };
    case "patch":
      return { to: "patchNotes" };
    case "assigned":
    case "commissioner":
    case "scout":
    case "recap":
      return undefined;
  }
}

/** A link to the league's settings, which Mail shows only to whoever runs it (S16.8). */
export const settingsLink = (league: Doc<"leagues">): LetterLink => ({ to: "settings", leagueId: league._id });

/** `letter` as filed of `kind`: with its own link, or else its kind's (`kindLink`). */
function linked(kind: LetterKind, letter: Written): Written {
  const link = (words: Letter): Letter => ({ ...words, link: words.link ?? kindLink(kind) });
  return typeof letter === "function" ? (tell) => link(letter(tell)) : link(letter);
}

/** Everyone with a part in the league, by email: its commissioner, co-commissioner and managers. */
export async function wholeLeague(ctx: QueryCtx, league: Doc<"leagues">): Promise<string[]> {
  const managers = (await teamsOf(ctx, league._id)).map((team) => team.managerEmail);
  return [league.commissionerEmail, league.coCommissionerEmail, ...managers].filter((email) => email !== undefined);
}

/** Files `letter`, of `kind`, in the league's name to each of `to`, once each. The copy to `by`,
 *  who wrote it or did what it reports, is filed read: they know. With no `by`, every copy is
 *  unread. */
export async function fileLetter(
  ctx: MutationCtx,
  league: Doc<"leagues">,
  kind: LetterKind,
  to: readonly string[],
  letter: Written,
  by?: string,
): Promise<void> {
  const at = Date.now();
  const copy = filed(linked(kind, letter));
  for (const email of new Set(to)) {
    await ctx.db.insert("letters", {
      to: email,
      leagueId: league._id,
      leagueName: league.name,
      at,
      kind,
      ...copy,
      readAt: email === by ? at : undefined,
    });
  }
}

/** Files `letter` from the site, in no league's name, to everyone with a part in any league, one
 *  copy each however many leagues they are in. The copy to `by`, who did what it reports, is filed
 *  read. Past LEAGUES_READ_MOST leagues it throws, and the change it reports with it, never
 *  reaching only some. */
export async function fileSiteLetter(ctx: MutationCtx, kind: LetterKind, letter: Written, by: string): Promise<void> {
  const leagues = await everyLeague(ctx, "so a letter from the site can't reach everyone in them");
  const everyone = new Set((await Promise.all(leagues.map((league) => wholeLeague(ctx, league)))).flat());
  const at = Date.now();
  const copy = filed(linked(kind, letter));
  for (const email of everyone) {
    await ctx.db.insert("letters", { to: email, at, kind, ...copy, readAt: email === by ? at : undefined });
  }
}

/** Whom the event takes out of the league, who are told too, as they no longer have a part in it. */
function takenOut(event: LeagueEvent): string[] {
  switch (event.kind) {
    case "commissionerNamed":
    case "coCommissionerNamed":
      return event.replaced === null ? [] : [event.replaced];
    case "coCommissionerRemoved":
    case "managerRemoved":
    case "managerLeft":
      return [event.email];
    case "created":
    case "managerAdded":
    case "teamRenamed":
    case "maxTeamsChanged":
    case "deletionStarted":
    case "deletionUndone":
    case "gameweekUsed":
    case "scoringStartSet":
    case "invited":
    case "inviteResent":
    case "inviteCancelled":
    case "joinedByInvite":
    case "joinRequestApproved":
    case "inviteLinkMade":
    case "inviteLinkSwitchedOff":
    case "rulesChanged":
    case "playerAssigned":
    case "playerMoved":
    case "playerReleased":
    case "playerDropped":
    case "playerClaimed":
    case "playerPickedUp":
    case "playerTraded":
    case "tradeMade":
    case "pointsOverridden":
    case "pointsOverrideRemoved":
    case "teamPointsOverridden":
    case "fixturesSwapped":
    case "autoTeamSwitched":
    case "matchAbandoned":
      return [];
  }
}

/** What the letter reporting the event is about: a squad move's own kind, a manager's own doing in
 *  the league, or else the commissioner's (or the admin's) action. */
function kindOf(event: LeagueEvent): LetterKind {
  switch (event.kind) {
    case "playerAssigned":
    case "playerMoved":
    case "playerReleased":
      return "assigned";
    case "playerDropped":
    case "playerClaimed":
    case "playerPickedUp":
      return "waivers";
    case "playerTraded":
    case "tradeMade":
      return "trade";
    case "autoTeamSwitched":
      return "lineup";
    case "managerLeft":
    case "joinedByInvite":
    case "teamRenamed":
      return "league";
    case "created":
    case "commissionerNamed":
    case "coCommissionerNamed":
    case "coCommissionerRemoved":
    case "managerAdded":
    case "managerRemoved":
    case "maxTeamsChanged":
    case "deletionStarted":
    case "deletionUndone":
    case "gameweekUsed":
    case "scoringStartSet":
    case "invited":
    case "inviteResent":
    case "inviteCancelled":
    case "joinRequestApproved":
    case "inviteLinkMade":
    case "inviteLinkSwitchedOff":
    case "rulesChanged":
    case "pointsOverridden":
    case "pointsOverrideRemoved":
    case "teamPointsOverridden":
    case "fixturesSwapped":
    case "matchAbandoned":
      return "commissioner";
  }
}

/** Where the letter reporting the event links, when not where its kind's do (`kindLink`): a rule
 *  change to League settings (S16.8, League rules), a manager added or removed to the table that
 *  lists the league's teams, a fixture swap to the table's fixtures. */
function eventLink(event: LeagueEvent, league: Doc<"leagues">): LetterLink | undefined {
  switch (event.kind) {
    case "rulesChanged":
      return settingsLink(league);
    case "managerAdded":
    case "managerRemoved":
    case "fixturesSwapped":
      return { to: "table" };
    default:
      return undefined;
  }
}

/** How whoever did something is named: the admin by `adminByline`, anyone else by their email. */
export function bylineOf(email: string): string {
  return isAdmin(email) ? adminByline : email;
}

/** Files the letter reporting a league's event to the whole league, as it is after the event, or
 *  only to `only`: read for `by` unless `unread`, as a waiver run's are, which `by` didn't watch
 *  happen. */
async function fileEventLetter(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
  by: string,
  event: LeagueEvent,
  unread: boolean,
  only: readonly string[] | undefined,
): Promise<void> {
  const league = await ctx.db.get("leagues", leagueId);
  if (!league) throw new Error(`League ${leagueId} doesn't exist, so its ${event.kind} letter can't be filed`);
  const to = only ?? [...(await wholeLeague(ctx, league)), ...takenOut(event)];
  const who = bylineOf(by);
  await fileLetter(ctx, league, kindOf(event), to, (tell) => ({ ...eventLetter(event, who, tell), link: eventLink(event, league) }), unread ? undefined : by);
}

/** Files what happened, with no Mail letter: a draft pick, which Mail doesn't report (Craig, 4 Nov
 *  2026, on #1091: "we dont need mail for that and each pick"). */
export async function fileEvent(ctx: MutationCtx, leagueId: Id<"leagues">, by: string, event: LeagueEvent): Promise<void> {
  await ctx.db.insert("leagueEvents", { leagueId, at: Date.now(), by, event });
  // A man gone from a squad mid-gameweek leaves his slot empty, so the live scores move (#2007).
  if (isSquadMove(event)) await rescoreLive(ctx, leagueId);
}

/** Files what happened, and the Mail letter reporting it (#26): the copy to `by` filed read, unless
 *  `unread`. With `only`, the letter goes to them alone, not the whole league. */
export async function recordEvent(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
  by: string,
  event: LeagueEvent,
  { unread = false, only }: { unread?: boolean; only?: readonly string[] } = {},
): Promise<void> {
  await fileEvent(ctx, leagueId, by, event);
  await fileEventLetter(ctx, leagueId, by, event, unread, only);
}
