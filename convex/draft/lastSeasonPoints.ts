import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { cardOpensAt } from "../playerCard/cardPoints";
import type { PositionsNow } from "../positions/playerPositions";
import type { Position } from "../positions/positionTables";
import { takeAllOrThrow } from "../shared/cappedRead";
import { SEASON_PLAYERS_MOST } from "../stats/matchRecords";

// Last season's points under the site's scoring as it stands, which auto-pick falls back on for a
// player the admin's ranking leaves out, or for every player while none is uploaded (spec/04, The
// queue and the ranking; #1094), and Scouting shows before the new season's first match (spec/19;
// #956, scouting/shownSeasonPoints.ts). Priced and kept by pastSeasons/pastSeasonPoints.ts (#1114).

/** Each player's points last season at his main position now (his card's, cardOpensAt), by FPL
 *  code: 0 for one in the data who played none, or who has no position yet. A player missing from
 *  it wasn't in last season's data: a newcomer. Last season is the newest priced; with none priced,
 *  everyone is a newcomer. */
export async function lastSeasonPoints(ctx: QueryCtx, positionsOf: PositionsNow): Promise<ReadonlyMap<number, number>> {
  const season = await lastPricedSeason(ctx);
  if (season === null) return new Map();
  const points = new Map<number, number>();
  for (const row of await lastSeasonRows(ctx, season)) points.set(row.playerCode, pointsAtMain(row.points, await positionsOf(row.playerCode)));
  return points;
}

/** His priced points at his main position now: 0 with no position yet. */
export function pointsAtMain(points: Doc<"pastSeasonPoints">["points"], positions: readonly Position[]): number {
  const position = cardOpensAt(positions);
  return position === null ? 0 : (points[position] ?? 0);
}

/** `season`'s priced rows: every player's, or only these players'. */
export async function lastSeasonRows(ctx: QueryCtx, season: number, only?: readonly number[]): Promise<Doc<"pastSeasonPoints">[]> {
  if (only !== undefined) {
    const rows = await Promise.all(
      only.map((code) =>
        ctx.db
          .query("pastSeasonPoints")
          .withIndex("by_season_and_playerCode", (q) => q.eq("season", season).eq("playerCode", code))
          .unique(),
      ),
    );
    return rows.filter((row) => row !== null);
  }
  return takeAllOrThrow(
    ctx.db.query("pastSeasonPoints").withIndex("by_season_and_playerCode", (q) => q.eq("season", season)),
    SEASON_PLAYERS_MOST,
    `More than ${SEASON_PLAYERS_MOST} players have points for the ${season} season, so they would be cut short`,
  );
}

/** The newest season priced, by the year it starts, or null while none is: the season
 *  `lastSeasonPoints` reads, which the draft room names over its points (spec/04, The draft room). */
export async function lastPricedSeason(ctx: QueryCtx): Promise<number | null> {
  return (await ctx.db.query("pastSeasonPoints").withIndex("by_season_and_playerCode").order("desc").first())?.season ?? null;
}
