import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { takeShown } from "../shared/cappedRead";

// The one-off clear for #1755: the `thresholdSteps` rows stored before #871 are neither read nor
// written, and Convex refuses a schema without the table while it holds rows. Alpha data is
// disposable (#1755), so they are deleted: the matches they belong to lose those threshold lines,
// and no score moves. Running it again does nothing. Run it once on each deployment, before the
// pull request that drops the table:
//   npx convex run stats/oldThresholdStepsClear:clearOldThresholdSteps
//   npx convex run --prod stats/oldThresholdStepsClear:clearOldThresholdSteps

/** The most rows one run deletes, well under Convex's writes a mutation; more are left to the run
 *  it schedules next. Claude's choice. */
export const OLD_STEPS_CLEARED_A_RUN = 1000;

/** Deletes up to OLD_STEPS_CLEARED_A_RUN rows; where more remain, schedules itself again. Returns
 *  how many it deleted and whether another run follows. */
export const clearOldThresholdSteps = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number(), more: v.boolean() }),
  handler: async (ctx) => {
    const { rows, more } = await takeShown(ctx.db.query("thresholdSteps"), OLD_STEPS_CLEARED_A_RUN);
    for (const row of rows) await ctx.db.delete("thresholdSteps", row._id);
    if (more) await ctx.scheduler.runAfter(0, internal.stats.oldThresholdStepsClear.clearOldThresholdSteps, {});
    return { deleted: rows.length, more };
  },
});
