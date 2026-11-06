import type { QueryCtx } from "../_generated/server";
import { cardOpensAt } from "../playerCard/cardPoints";
import type { PositionsNow } from "../positions/playerPositions";
import { takeAllOrThrow } from "../shared/cappedRead";
import { SEASON_PLAYERS_MOST } from "../stats/matchRecords";

// Last season's points under the site's scoring as it stands, which auto-pick falls back on for a
// player the admin's ranking leaves out, or for every player while none is uploaded (spec/04, The
// queue and the ranking; #1094). Priced and kept by pastSeasons/pastSeasonPoints.ts (#1114).

/** Each player's points last season at his main position now (his card's, cardOpensAt), by FPL
 *  code: 0 for one in the data who played none, or who has no position yet. A player missing from
 *  it wasn't in last season's data: a newcomer. Last season is the newest priced; with none priced,
 *  everyone is a newcomer. */
export async function lastSeasonPoints(ctx: QueryCtx, positionsOf: PositionsNow): Promise<ReadonlyMap<number, number>> {
  const season = await lastPricedSeason(ctx);
  if (season === null) return new Map();
  const rows = await takeAllOrThrow(
    ctx.db.query("pastSeasonPoints").withIndex("by_season_and_playerCode", (q) => q.eq("season", season)),
    SEASON_PLAYERS_MOST,
    `More than ${SEASON_PLAYERS_MOST} players have points for the ${season} season, so they would be cut short`,
  );
  const points = new Map<number, number>();
  for (const row of rows) {
    const position = cardOpensAt(await positionsOf(row.playerCode));
    points.set(row.playerCode, position === null ? 0 : (row.points[position] ?? 0));
  }
  return points;
}

/** The newest season priced, by the year it starts, or null while none is: the season
 *  `lastSeasonPoints` reads, which the draft room names over its points (spec/04, The draft room). */
export async function lastPricedSeason(ctx: QueryCtx): Promise<number | null> {
  return (await ctx.db.query("pastSeasonPoints").withIndex("by_season_and_playerCode").order("desc").first())?.season ?? null;
}
