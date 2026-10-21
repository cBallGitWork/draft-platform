import type { Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { isAdmin, teamsOf } from "./leagueAccess";
import { adminByline, eventLetter } from "./letterWords";
import type { leagueEvent } from "./schema";

// Filing Mail's letters (#26, spec/16): the one way any feature puts a letter in someone's Mail.

/** What a letter says, and who wrote it, if someone did (schema.ts, `letterFields`). */
export type Letter = Pick<Doc<"letters">, "subject" | "body" | "from">;

/** Everyone with a part in the league, by email: its commissioner, co-commissioner and managers. */
export async function wholeLeague(ctx: QueryCtx, league: Doc<"leagues">): Promise<string[]> {
  const managers = (await teamsOf(ctx, league._id)).map((team) => team.managerEmail);
  return [league.commissionerEmail, league.coCommissionerEmail, ...managers].filter((email) => email !== undefined);
}

/** Files `letter` in the league's name to each of `to`, once each. The copy to `by`, who wrote it
 *  or did what it reports, is filed read: they know. */
export async function fileLetter(
  ctx: MutationCtx,
  league: Doc<"leagues">,
  to: readonly string[],
  letter: Letter,
  by: string,
): Promise<void> {
  const at = Date.now();
  for (const email of new Set(to)) {
    await ctx.db.insert("letters", {
      to: email,
      leagueId: league._id,
      leagueName: league.name,
      at,
      ...letter,
      readAt: email === by ? at : undefined,
    });
  }
}

type LeagueEvent = Infer<typeof leagueEvent>;

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
    case "invited":
    case "inviteResent":
    case "inviteCancelled":
    case "joinedByInvite":
    case "joinRequestApproved":
    case "inviteLinkMade":
    case "inviteLinkSwitchedOff":
    case "rulesChanged":
      return [];
  }
}

/** Files the letter reporting a league's event to the whole league, as it is after the event. */
export async function fileEventLetter(ctx: MutationCtx, leagueId: Id<"leagues">, by: string, event: LeagueEvent): Promise<void> {
  const league = await ctx.db.get("leagues", leagueId);
  if (!league) throw new Error(`League ${leagueId} doesn't exist, so its ${event.kind} letter can't be filed`);
  const to = [...(await wholeLeague(ctx, league)), ...takenOut(event)];
  await fileLetter(ctx, league, to, eventLetter(event, isAdmin(by) ? adminByline : by), by);
}
