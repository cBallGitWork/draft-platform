// The two writes scripts/past-season.mjs loads a past season with, through `convex run`: the
// season's old rows cleared a page at a time, then its rows added a batch at a time. Internal, so
// only a signed-in deployment admin's CLI calls them.

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { pastSeasonRow } from "../schema";
import { PAST_ROWS_ADDED_MOST, PAST_ROWS_CLEARED } from "./pastSeasonLimits";

/** Deletes up to PAST_ROWS_CLEARED of the season's rows; `more` while any are left. */
export const clearSeason = internalMutation({
  args: { season: v.number() },
  returns: v.object({ deleted: v.number(), more: v.boolean() }),
  handler: async (ctx, { season }) => {
    const rows = await ctx.db
      .query("pastPlayerMatchStats")
      .withIndex("by_season_and_playerCode", (q) => q.eq("season", season))
      .take(PAST_ROWS_CLEARED + 1);
    const page = rows.slice(0, PAST_ROWS_CLEARED);
    for (const row of page) await ctx.db.delete("pastPlayerMatchStats", row._id);
    return { deleted: page.length, more: rows.length > PAST_ROWS_CLEARED };
  },
});

/** Adds one batch of rows; more than PAST_ROWS_ADDED_MOST throws, so a batch is never cut. */
export const addRows = internalMutation({
  args: { rows: v.array(pastSeasonRow) },
  returns: v.number(),
  handler: async (ctx, { rows }) => {
    if (rows.length > PAST_ROWS_ADDED_MOST) throw new Error(`A batch of ${rows.length} rows is over the ${PAST_ROWS_ADDED_MOST} one call adds`);
    for (const row of rows) await ctx.db.insert("pastPlayerMatchStats", row);
    return rows.length;
  },
});
