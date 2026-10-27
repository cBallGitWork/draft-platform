import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { logFailure } from "../shared/errors";
import { syncDue } from "./matchStatsSync";
import { delayCommentary } from "../football/matchCommentary";
import type { liveStatsTickFields } from "../schema";
import type { DueMatch } from "./matchStats";

// Issue #28: the live poller's tick, run every minute by `crons.ts`. Outside every match window
// it reads no feed and writes nothing; inside one, it reads each live match as `matchStatsSync`
// does, and keeps its score and clock fresh (#49, football/matchScores.ts) and its commentary
// (#43, football/matchCommentary.ts). Why a cron, and how a failed tick is caught up:
// ARCHITECTURE.md.

type Outcome = Infer<typeof liveStatsTickFields.outcome>;

export const tick = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const ranAt = Date.now();
    let outcome: Outcome;
    let live: DueMatch[] = [];
    try {
      live = await ctx.runQuery(internal.stats.liveStats.live, { now: ranAt });
      if (live.length === 0) return null;
      const { matches, scores } = await syncDue(ctx, live, ranAt, "live");
      outcome = { ok: true, matches, scores };
    } catch (error: unknown) {
      outcome = { ok: false, error: logFailure("live stats tick failed", error) };
      // A tick that read nothing read no commentary either: each live match's is delayed (#43).
      await delayCommentary(ctx, live.map(({ fixtureCode }) => fixtureCode), outcome.error, ranAt);
    }
    await ctx.runMutation(internal.stats.liveStats.recordTick, { ranAt, outcome });
    return null;
  },
});
