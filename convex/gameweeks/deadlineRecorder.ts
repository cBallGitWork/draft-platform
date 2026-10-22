import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { errorMessage } from "../shared/errors";
import { isLocked } from "./deadline";
import { passedDeadlinesOf } from "./passedDeadlines";
import { heldSchedule, leagueDeadlinesIn } from "../rules/leagueRules";

// Records each league's passed deadlines (#150), so a postponement after one can't move it
// (deadline.ts). The football sync, the only writer of kickoffs, runs this before it writes the
// fixtures: until then, the deadline worked out from the kickoffs is the one that passed. A
// deadline already recorded is left as it is, so running this twice does no harm.
//
// It fails closed: if recording fails, for any league, the whole sync fails, is logged and filed
// in footballSyncs, and no kickoff moves, so no league's lineups can reopen. The feed stands still
// for every league until it is fixed. A league whose rules can't be read (only a row written by
// hand can be: a commissioner's change is checked) isn't skipped, because skipping it would let
// its kickoffs move with its passed deadlines unrecorded, and that could reopen its gameweek.

/** Records every league's deadlines that have passed and aren't yet recorded; returns how many. */
export const recordPassed = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    // Read once for every league: the fixtures are the season's 380, the most of any table here.
    const { matches } = await heldSchedule(ctx);
    let recorded = 0;
    for await (const league of ctx.db.query("leagues")) {
      const passed = await passedDeadlinesOf(ctx, league._id);
      const deadlines = await leagueDeadlinesIn(ctx, league._id, matches).catch((error: unknown) => {
        // Named, so the failed sync's log and run row say which league to fix.
        throw new Error(`League ${league._id} (${league.name}): its deadlines can't be worked out: ${errorMessage(error)}`);
      });
      for (const [gameweek, deadline] of deadlines) {
        if (deadline === null || passed.has(gameweek) || !isLocked(deadline, now)) continue;
        await ctx.db.insert("passedDeadlines", { leagueId: league._id, gameweek, deadline, recordedAt: now });
        recorded += 1;
      }
    }
    return recorded;
  },
});
