import { v } from "convex/values";
import { internalMutation, type QueryCtx } from "../_generated/server";
import { MINUTE_MS } from "../shared/time";

// The platform's own settings, one row each, the admin's to change (spec/15). Until the admin
// screen exists: `npx convex run admin/platformSettings:setStatCorrectionWindow '{"minutes":60}'`.

/** How long after full time a match's stats stay open to corrections (spec/07), until set. */
const DEFAULT_STAT_CORRECTION_WINDOW_MINUTES = 60;

const STAT_CORRECTION_WINDOW = "statCorrectionWindowMinutes";

/** The stat-correction window in milliseconds: the admin's setting, or the default. */
export async function statCorrectionWindowMs(ctx: QueryCtx): Promise<number> {
  const row = await windowRow(ctx);
  return (row?.value ?? DEFAULT_STAT_CORRECTION_WINDOW_MINUTES) * MINUTE_MS;
}

/** Sets the window. A lock already scheduled reads it again when it fires. */
export const setStatCorrectionWindow = internalMutation({
  args: { minutes: v.number() },
  handler: async (ctx, { minutes }) => {
    if (!Number.isInteger(minutes) || minutes < 0) {
      throw new Error(`The stat-correction window is a whole number of minutes, 0 or more, not ${minutes}`);
    }
    const row = await windowRow(ctx);
    if (row === null) await ctx.db.insert("platformSettings", { name: STAT_CORRECTION_WINDOW, value: minutes });
    else await ctx.db.patch("platformSettings", row._id, { value: minutes });
  },
});

function windowRow(ctx: QueryCtx) {
  return ctx.db
    .query("platformSettings")
    .withIndex("by_name", (q) => q.eq("name", STAT_CORRECTION_WINDOW))
    .unique();
}
