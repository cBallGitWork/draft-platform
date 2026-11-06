import { v } from "convex/values";
import { mutation, type QueryCtx } from "../_generated/server";
import { takeAllOrThrow } from "../shared/cappedRead";
import { heldSeason } from "../shared/fixtures";
import { adminOf, refuse } from "../shared/leagueAccess";
import { CURRENT_CLUBS_MOST, findClubByCode } from "../shared/players";

// A club's points deduction: the admin sets its total points in the Premier League table, in place
// of what its results earn (spec/18, The table: "you hard override the total points", Craig, 1 Nov
// 2026; #898). Held for the season the feed's matches are for, so a new season starts clean. No
// screen yet: the admin runs it from the CLI (docs/setup.md).

/** Why a total is refused, as the admin is told it. */
export const pointsOverrideRefusals = {
  noSeason: "No season's matches are held yet, so there's no table to set a total in.",
  notCurrent: "That club isn't in the Premier League now.",
  notWhole: "Set a club's total to a whole number of points.",
} as const;

/** Sets a current club's total points this season, or, with `points` null, goes back to its
 *  results' total. */
export const set = mutation({
  args: { clubCode: v.number(), points: v.union(v.number(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { clubCode, points }) => {
    await adminOf(ctx);
    const season = (await heldSeason(ctx)) ?? refuse(pointsOverrideRefusals.noSeason);
    const club = await findClubByCode(ctx, clubCode);
    if (club === null || club.droppedAt !== undefined) refuse(pointsOverrideRefusals.notCurrent);
    if (points !== null && !Number.isInteger(points)) refuse(pointsOverrideRefusals.notWhole);
    const held = await ctx.db
      .query("plPointsOverrides")
      .withIndex("by_season_and_clubCode", (q) => q.eq("season", season).eq("clubCode", clubCode))
      .unique();
    if (points === null) {
      if (held !== null) await ctx.db.delete("plPointsOverrides", held._id);
    } else if (held === null) {
      await ctx.db.insert("plPointsOverrides", { season, clubCode, points });
    } else {
      await ctx.db.patch("plPointsOverrides", held._id, { points });
    }
    return null;
  },
});

/** The season's set totals, by club code: one a club at most, so never more than there are clubs. */
export async function seasonPointsOverrides(ctx: QueryCtx, season: number): Promise<Map<number, number>> {
  const rows = await takeAllOrThrow(
    ctx.db.query("plPointsOverrides").withIndex("by_season_and_clubCode", (q) => q.eq("season", season)),
    CURRENT_CLUBS_MOST,
    `More than ${CURRENT_CLUBS_MOST} clubs have a total set in season ${season}, so some would be left out`,
  );
  return new Map(rows.map(({ clubCode, points }) => [clubCode, points]));
}
