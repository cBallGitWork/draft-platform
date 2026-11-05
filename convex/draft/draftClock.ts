import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { SECOND_MS } from "../shared/time";
import { draftOf } from "./draftRow";
import { pickOnTheClock } from "./snakeOrder";

// The pick clock (spec/04, The picks; #1091). Each pick runs on the league's pick time. The first
// clock starts with the draft; each after waits 10 seconds from the pick before it, whoever made it
// (Craig, 4 Nov 2026, on #1091), the window a manager will have to undo his own pick. When a clock
// runs out, the draft picks for the team (draftPicks.ts `autoPick`), whether or not its manager is
// online. A team with no manager is picked for at once, as its clock starts (Craig, 4 Nov 2026, on
// #1091). The commissioner can pause and resume it (draftPause.ts; #1135). Not built yet: the
// commissioner's "I'll pick for this one" and the timeout count (#1136).

/** How long after a pick the next pick's clock starts (Craig, 4 Nov 2026: "Yes, clock waits"). */
export const PICK_GAP_MS = 10 * SECOND_MS;

/** The pick a clock was started for: its number and round, its team, and when its clock starts and
 *  runs out. */
export type Clocked = { pick: number; round: number; team: Doc<"teams">; startsAt: number; endsAt: number };

/** Puts the pick after the league's first `picksMade` on the clock, from `startsAt` for
 *  `pickSeconds`, scheduling the pick the draft makes for its team, and returns it; once every pick
 *  is made, takes the clock away and returns null. The caller cancels any job still waiting on the
 *  clock before: never the job running now, as cancelling it would cancel what it schedules too. */
export async function startClock(ctx: MutationCtx, leagueId: Id<"leagues">, picksMade: number, startsAt: number, pickSeconds: number): Promise<Clocked | null> {
  const draft = await draftOf(ctx, leagueId);
  if (draft?.started === undefined) throw new Error(`League ${leagueId}'s draft hasn't started, so no pick can be put on the clock`);
  const turn = pickOnTheClock(draft.started.teamIds, draft.started.rounds, picksMade);
  if (turn === null) {
    await ctx.db.patch("drafts", draft._id, { clock: undefined });
    return null;
  }
  const team = await ctx.db.get("teams", turn.team);
  if (team === null) throw new Error(`League ${leagueId}'s draft names team ${turn.team}, which doesn't exist`);
  const endsAt = startsAt + pickSeconds * SECOND_MS;
  const firesAt = team.managerEmail === undefined ? startsAt : endsAt;
  const job = await ctx.scheduler.runAt(firesAt, internal.draft.draftPicks.autoPick, { leagueId, pick: turn.pick });
  await ctx.db.patch("drafts", draft._id, { clock: { pick: turn.pick, startsAt, endsAt, job } });
  return { pick: turn.pick, round: turn.round, team, startsAt, endsAt };
}
