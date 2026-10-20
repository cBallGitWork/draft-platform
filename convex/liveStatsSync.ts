import type { Infer } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { logFailure, syncDue } from "./matchStatsSync";
import type { liveStatsTickFields } from "./schema";

// Issue #28: the live poller's tick, run every minute by `crons.ts`. Outside every match window
// it reads no feed and writes nothing. Inside one, it reads both feeds for each live match, as
// `matchStatsSync` does, and writes what they send: provisional before full time, through the
// full-time path after. Both feeds send running totals, so a tick that fails or is skipped is
// caught up whole by the next one. Why a cron and not a self-rescheduling chain: ARCHITECTURE.md.

type Outcome = Infer<typeof liveStatsTickFields.outcome>;

export const tick = internalAction({
  args: {},
  handler: async (ctx) => {
    const ranAt = Date.now();
    let outcome: Outcome;
    try {
      const live = await ctx.runQuery(internal.liveStats.live, { now: ranAt });
      if (live.length === 0) return;
      outcome = { ok: true, matches: (await syncDue(ctx, live, ranAt, "live")).matches };
    } catch (error: unknown) {
      outcome = { ok: false, error: logFailure("live stats tick failed", error) };
    }
    await ctx.runMutation(internal.liveStats.recordTick, { ranAt, outcome });
  },
});
