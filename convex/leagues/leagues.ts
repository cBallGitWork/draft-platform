import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalAction, internalMutation, mutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { LeagueEvent } from "../schema";
import { admitEmail } from "../signIn/allowedEmails";
import {
  adminOf,
  callerEmail,
  getLeague,
  namedEmail,
  namerOf,
  refuse,
  refusals,
  runnerOf,
  teamsOf,
} from "../shared/leagueAccess";
import { typedName } from "../shared/typedText";
import { recordEvent } from "../mail/letters";
import { checkSoon } from "./leagueChecks";
import { FEWEST_TEAMS, LEAGUE_NAME_MAX, MOST_TEAMS } from "./leagueLimits";
import { giveDefaultRules, refuseTooFewForGames } from "../rules/leagueRules";
import { latestRules } from "../rules/rulesHistory";
import { askForLink, hasOpenedALink } from "../signIn/signInLinks";
import { signInReply } from "../signIn/signInReplies";
import { passReviews } from "../trades/tradeReviewers";

// A league, and who runs it (#24, spec/13). Each change files an event for Mail (#26).

function checkMaxTeams(maxTeams: number): void {
  if (!Number.isInteger(maxTeams) || maxTeams < FEWEST_TEAMS || maxTeams > MOST_TEAMS) refuse(refusals.maxOutOfRange);
}

/** Lets a newly named commissioner sign in, and sends them a sign-in link unless they have opened
 *  one before (spec/13, Creating a league). */
async function admitCommissioner(ctx: MutationCtx, email: string, leagueId: Id<"leagues">): Promise<void> {
  await admitEmail(ctx, email);
  if (!(await hasOpenedALink(ctx, email))) {
    await ctx.scheduler.runAfter(0, internal.leagues.leagues.sendCommissionerLink, { leagueId, email });
  }
}

/** A league made as the admin `by` asks: refuses a blank name or one over LEAGUE_NAME_MAX
 *  characters, a maximum of teams out of range or too few for the default rules' games a
 *  gameweek, and a commissioner email without an "@". `create`'s body, shared with the e2e seed
 *  (convex/e2e/seed.ts), which has no one signed in. */
export async function createLeague(
  ctx: MutationCtx,
  by: string,
  args: { name: string; maxTeams: number; commissionerEmail: string; classic?: boolean; noCommissioner?: boolean },
): Promise<Id<"leagues">> {
  const name = typedName(args.name, LEAGUE_NAME_MAX, { blank: refusals.blankName, tooLong: refusals.leagueNameTooLong });
  checkMaxTeams(args.maxTeams);
  const email = namedEmail(args.commissionerEmail);

  const leagueId = await ctx.db.insert("leagues", { name, maxTeams: args.maxTeams, ...(args.noCommissioner ? { setUpBy: email } : { commissionerEmail: email }) });
  await recordEvent(ctx, leagueId, by, { kind: "created", name, maxTeams: args.maxTeams });
  if (!args.noCommissioner) await recordEvent(ctx, leagueId, by, { kind: "commissionerNamed", email, replaced: null });
  await giveDefaultRules(ctx, leagueId, args.maxTeams, args.classic);
  await checkSoon(ctx, leagueId);
  await admitCommissioner(ctx, email, leagueId);
  return leagueId;
}

/** For the admin alone, refusing as `createLeague` says. `classic` makes it a classic league
 *  (spec/22, `S22.2`), for good; absent, it isn't. `noCommissioner` makes it with none, the email
 *  named its set-up manager (spec/01 S01.1). */
export const create = mutation({
  args: {
    name: v.string(),
    maxTeams: v.number(),
    commissionerEmail: v.string(),
    classic: v.optional(v.boolean()),
    noCommissioner: v.optional(v.boolean()),
  },
  returns: v.id("leagues"),
  handler: async (ctx, args) => createLeague(ctx, await adminOf(ctx), args),
});

/** spec/13: the commissioner raises or lowers the maximum, never below the teams already there,
 *  nor lowered below the teams its latest rules' games a gameweek need. */
export const setMaxTeams = mutation({
  args: { leagueId: v.id("leagues"), maxTeams: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, maxTeams }) => {
    const { email, league } = await runnerOf(ctx, leagueId);
    checkMaxTeams(maxTeams);
    const teamCount = (await teamsOf(ctx, leagueId)).length;
    if (maxTeams < teamCount) refuse(refusals.belowTeams(teamCount));
    if (maxTeams < league.maxTeams) refuseTooFewForGames(await latestRules(ctx, leagueId), maxTeams);
    if (maxTeams === league.maxTeams) return null;
    await ctx.db.patch("leagues", leagueId, { maxTeams });
    await recordEvent(ctx, leagueId, email, { kind: "maxTeamsChanged", from: league.maxTeams, to: maxTeams });
    return null;
  },
});

/** Makes `event.email` the league's commissioner, files `event` and lets them in. A trade in
 *  review goes to whoever reviews it now (`passReviews`). A co-commissioner taking the role on
 *  stops being co-commissioner. */
export async function handOver(
  ctx: MutationCtx,
  league: Doc<"leagues">,
  by: string,
  event: Extract<LeagueEvent, { kind: "commissionerNamed" | "commissionerSteppedDown" }>,
): Promise<void> {
  const { email } = event;
  // The last commissioner's link, if it didn't go, is theirs: no longer the admin's concern.
  await ctx.db.patch("leagues", league._id, {
    commissionerEmail: email,
    commissionerLink: undefined,
    // A commissioner ends the set-up manager's time running the league (spec/01 S01.1).
    setUpBy: undefined,
    ...(email === league.coCommissionerEmail ? { coCommissionerEmail: undefined } : {}),
  });
  await recordEvent(ctx, league._id, by, event);
  await admitCommissioner(ctx, email, league._id);
  await passReviews(ctx, league._id);
}

/** Hands the league to a new commissioner. Only the commissioner or the admin may. */
export const nameCommissioner = mutation({
  args: { leagueId: v.id("leagues"), email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { email: by, league } = await namerOf(ctx, args.leagueId);
    const email = namedEmail(args.email);
    if (email === league.commissionerEmail) refuse(refusals.alreadyCommissioner(email));
    if (email === league.coCommissionerEmail) refuse(refusals.alreadyCoCommissioner(email));
    await handOver(ctx, league, by, { kind: "commissionerNamed", email, replaced: league.commissionerEmail ?? null });
    return null;
  },
});

/** The events that put a manager on a team (teams.ts's putOnTeam): the latest of them on a team is
 *  its manager's joining. */
const JOINING_KINDS = ["managerAdded", "joinedByInvite", "joinRequestApproved"] as const;

/** The manager other than `besides` who joined the league first, by when they took the team they
 *  run now, or null when there is none. A team with no joining event is its first manager's since
 *  it was made, so it counts from then. */
async function firstToHaveJoined(ctx: QueryCtx, leagueId: Id<"leagues">, besides: string): Promise<string | null> {
  const managed = (await teamsOf(ctx, leagueId)).flatMap(({ managerEmail: email, ...team }) =>
    email === undefined || email === besides ? [] : [{ ...team, email }],
  );
  const joined = await Promise.all(
    managed.map(async (team) => {
      const joinings = await Promise.all(
        JOINING_KINDS.map((kind) =>
          ctx.db
            .query("leagueEvents")
            .withIndex("by_teamId_and_kind_and_at", (q) => q.eq("event.teamId", team._id).eq("event.kind", kind))
            .order("desc")
            .first(),
        ),
      );
      const at = Math.max(team._creationTime, ...joinings.map((joining) => joining?.at ?? 0));
      return { email: team.email, at, number: team.number };
    }),
  );
  joined.sort((a, b) => a.at - b.at || a.number - b.number);
  return joined[0]?.email ?? null;
}

/** spec/01 S01.5: the commissioner steps down, and the role passes to the co-commissioner, or with
 *  none to the manager who joined first, who can hand it on (`nameCommissioner`). With neither
 *  there is no one to take it, so it is refused: a league is without one only when made so. */
export const stepDown = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const by = await callerEmail(ctx);
    const league = await getLeague(ctx, leagueId);
    if (by !== league.commissionerEmail) refuse(refusals.notCommissioner);
    const email = league.coCommissionerEmail ?? (await firstToHaveJoined(ctx, leagueId, by)) ?? refuse(refusals.noOneToTakeOver);
    await handOver(ctx, league, by, { kind: "commissionerSteppedDown", email, replaced: by });
    return null;
  },
});

/** Names the league's one co-commissioner, replacing any, or with `email` null removes them. Only
 *  the commissioner or the admin may. A trade in review goes to whoever reviews it now
 *  (`passReviews`). */
export const nameCoCommissioner = mutation({
  args: { leagueId: v.id("leagues"), email: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { email: by, league } = await namerOf(ctx, args.leagueId);
    const email = args.email === null ? null : namedEmail(args.email);
    if (email === league.commissionerEmail) refuse(refusals.alreadyCommissioner(email));
    const replaced = league.coCommissionerEmail ?? null;
    if (email === replaced) return null;
    await ctx.db.patch("leagues", league._id, { coCommissionerEmail: email ?? undefined });
    if (email !== null) {
      await recordEvent(ctx, league._id, by, { kind: "coCommissionerNamed", email, replaced });
      await admitEmail(ctx, email);
    } else if (replaced !== null) {
      await recordEvent(ctx, league._id, by, { kind: "coCommissionerRemoved", email: replaced });
    }
    await passReviews(ctx, league._id);
    return null;
  },
});

/** Sends a newly named commissioner their sign-in link the way the sign-in page asks for one,
 *  and keeps the answer on the league, so the admin sees a link that didn't go. */
export const sendCommissionerLink = internalAction({
  args: { leagueId: v.id("leagues"), email: v.string() },
  returns: v.null(),
  handler: async (ctx, { leagueId, email }) => {
    const reply = await askForLink(ctx, email);
    await ctx.runMutation(internal.leagues.leagues.recordCommissionerLink, { leagueId, email, reply });
    return null;
  },
});

export const recordCommissionerLink = internalMutation({
  args: { leagueId: v.id("leagues"), email: v.string(), reply: signInReply },
  returns: v.null(),
  handler: async (ctx, { leagueId, email, reply }) => {
    const league = await ctx.db.get("leagues", leagueId);
    if (!league) throw new Error(`League ${leagueId} doesn't exist, so ${email}'s sign-in link can't be kept on it`);
    // An answer that comes back after another commissioner was named is no longer the league's.
    if (league.commissionerEmail !== email && league.setUpBy !== email) return null;
    await ctx.db.patch("leagues", leagueId, { commissionerLink: { email, reply } });
    return null;
  },
});
