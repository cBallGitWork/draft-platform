import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { basePoints } from "../playerCard/cardPoints";
import { POSITIONS } from "../positions/positionTables";
import type { StoredScoringSet } from "../scoring/scoringSetShape";
import { siteScoringAt } from "../scoring/siteVersions";
import { takeAllOrThrow } from "../shared/cappedRead";
import { PLAYERS_PAGE } from "../stats/matchRecords";
import type { PastMatch } from "./pastSeasonRows";

// Last season's points under the site's scoring as it stands (#1114): what auto-pick falls back on
// (spec/04, Auto-pick) and what Scouting shows before the new season's first match (spec/19, #956).
// Each player in last season's copied matches (pastSeasonRows.ts) gets a row, his matches priced at
// every position under today's set, so he is read at his main position now (draft/lastSeasonPoints.ts);
// one in the data who played none is on 0, and a newcomer, "Not in last season's data" (Craig,
// 4 Nov 2026), has none. Last season is the newest one copied. A paged job sets the rows afresh,
// run after the copy (scripts/past-season.mjs) and whenever a version of the site's set takes
// effect (siteScoring.ts).

/** The most rows one player has in a season: 38 matches, with room. More throws, never a cut. */
export const PAST_PLAYER_ROWS_MOST = 100;

/** His matches' base points under `set`, added up at each position, by position: none for a player
 *  who played no match. */
export function pastPointsByPosition(matches: readonly PastMatch[], set: StoredScoringSet): Record<string, number> {
  const sums: Record<string, number> = {};
  for (const { stats } of matches) {
    for (const position of POSITIONS) {
      const points = basePoints(stats, set, [position])[0].total;
      if (points !== null) sums[position] = (sums[position] ?? 0) + points;
    }
  }
  return sums;
}

/** The newest past season copied, or null with none. */
async function lastSeasonCopied(ctx: QueryCtx): Promise<number | null> {
  return (await ctx.db.query("pastPlayerMatchStats").withIndex("by_season_and_playerCode").order("desc").first())?.season ?? null;
}

function rowOf(ctx: QueryCtx, season: number, playerCode: number) {
  return ctx.db
    .query("pastSeasonPoints")
    .withIndex("by_season_and_playerCode", (q) => q.eq("season", season).eq("playerCode", playerCode))
    .unique();
}

/** Sets his row for `season` afresh from his copied matches under `set`: none while he isn't in
 *  that season's data. */
async function repricePlayer(ctx: MutationCtx, season: number, playerCode: number, set: StoredScoringSet): Promise<void> {
  const copied = await takeAllOrThrow(
    ctx.db.query("pastPlayerMatchStats").withIndex("by_season_and_playerCode", (q) => q.eq("season", season).eq("playerCode", playerCode)),
    PAST_PLAYER_ROWS_MOST,
    `Player ${playerCode} has more than ${PAST_PLAYER_ROWS_MOST} rows in the ${season} season, so his points would be cut short`,
  );
  const row = await rowOf(ctx, season, playerCode);
  if (copied.length === 0) {
    if (row !== null) await ctx.db.delete("pastSeasonPoints", row._id);
    return;
  }
  const matches = copied.flatMap(({ match }) => (match === null ? [] : [match]));
  const kept = { season, playerCode, points: pastPointsByPosition(matches, set) };
  if (row === null) await ctx.db.insert("pastSeasonPoints", kept);
  else await ctx.db.replace("pastSeasonPoints", row._id, kept);
}

/** Re-prices last season a page of PLAYERS_PAGE players at a time, from `cursor` (null for the
 *  first), under the site's set in force as each page runs, then runs on to the next page until
 *  every player is done. Safe to run again: it sets, never adds. */
export const reprice = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const season = await lastSeasonCopied(ctx);
    if (season === null) return null;
    const set = await siteScoringAt(ctx, Date.now());
    const page = await ctx.db.query("players").paginate({ numItems: PLAYERS_PAGE, cursor });
    for (const { code } of page.page) await repricePlayer(ctx, season, code, set);
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.pastSeasons.pastSeasonPoints.reprice, { cursor: page.continueCursor });
    return null;
  },
});
