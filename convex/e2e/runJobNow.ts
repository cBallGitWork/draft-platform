import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { refuseUnlessE2E } from "./e2eGate";

// "Run this timed job now" (spec/20, S20.17; #2288): an e2e run's throwaway server has its timed
// jobs off, so a test passes a deadline, a waiver run or its trade offers' closing by asking for the
// job here. It runs the job's own entry point, never a copy, as at `now`, which a test sets past the
// time it wants passed (a deadline, a run time), since a real server's clock can't be moved.

/** Runs one timed job, as it would run at `now` (by default, now): `deadlines` records every
 *  league's passed deadlines, as the deadline alarm does, `waivers` starts the league's waiver run
 *  or its free agents' return to waivers if due, and `offers` closes the league's offers whose time
 *  is up. What the job starts after (a run's tries, the auto team's lineups) runs on its own. */
export const runJobNow = internalMutation({
  args: { job: v.union(v.literal("deadlines"), v.literal("waivers"), v.literal("offers")), leagueId: v.id("leagues"), now: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { job, leagueId, now }) => {
    refuseUnlessE2E();
    if (job === "deadlines") await ctx.runMutation(internal.gameweeks.deadlineRecorder.recordDueDeadlines, { now });
    else if (job === "waivers") await ctx.runMutation(internal.waivers.waiverRun.runLeagueDue, { leagueId, now });
    else await ctx.runMutation(internal.trades.tradeClose.closeLeagueDue, { leagueId, now });
    return null;
  },
});
