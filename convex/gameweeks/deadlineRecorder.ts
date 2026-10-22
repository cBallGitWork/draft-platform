import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { isLocked } from "./deadline";
import { passedDeadlinesOf } from "./passedDeadlines";
import { leagueDeadlines } from "../rules/leagueRules";

// Records each league's passed deadlines (#150), so a postponement after one can't move it
// (deadline.ts). The football sync, the only writer of kickoffs, runs this before it writes the
// fixtures: until then, the deadline worked out from the kickoffs is the one that passed. A
// deadline already recorded is left as it is, so running this twice does no harm. A failure fails
// that sync, which logs it and files it in footballSyncs, and leaves the kickoffs unmoved.

/** Records every league's deadlines that have passed and aren't yet recorded; returns how many. */
export const recordPassed = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    let recorded = 0;
    for await (const league of ctx.db.query("leagues")) {
      const passed = await passedDeadlinesOf(ctx, league._id);
      for (const [gameweek, deadline] of await leagueDeadlines(ctx, league._id)) {
        if (deadline === null || passed.has(gameweek) || !isLocked(deadline, now)) continue;
        await ctx.db.insert("passedDeadlines", { leagueId: league._id, gameweek, deadline, recordedAt: now });
        recorded += 1;
      }
    }
    return recorded;
  },
});
