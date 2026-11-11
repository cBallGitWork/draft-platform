import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { lastPricedSeason, lastSeasonRows, pointsAtMain } from "../draft/lastSeasonPoints";
import { heldFixturesSeason } from "../shared/fixtures";
import { seasonPointsIn, seasonPriced, type SeasonPointsOf } from "../stats/seasonPoints";

// The season points Scouting shows (spec/19, The players list), on the list and in compare alike.
// Before the new season's first match is priced, they are last season's, under the site's scoring
// as it stands now (Craig, 1 Nov 2026; #956): no league's overrides, so every league sees the same
// figure, as auto-pick's fallback does, and a newcomer not in last season's data is "—", sorted
// below every figure (Craig, 6 Nov 2026, taking the recommendations on #956). From the first match
// on, they are this season's, as his card adds them up in the league (seasonPoints.ts).

interface ShownSeasonPoints {
  /** The season the points are from, by the year it starts, while they are last season's, so the
   *  screen can say so ("Pts 25/26"); null while they are this season's. */
  lastSeason: number | null;
  pointsOf: SeasonPointsOf;
}

/** Each player's shown season points in the league. `only` reads just those players' rows; without
 *  it, every player's, as the list needs. Last season's are shown while the held season (the one
 *  the feed's matches are in) has no player priced and an earlier season is. */
export async function shownSeasonPoints(ctx: QueryCtx, leagueId: Id<"leagues">, only?: readonly number[]): Promise<ShownSeasonPoints> {
  const held = await heldFixturesSeason(ctx);
  if (held === null || !(await seasonPriced(ctx, held))) {
    const last = await lastPricedSeason(ctx);
    if (last !== null && (held === null || last < held)) {
      const rows = new Map((await lastSeasonRows(ctx, last, only)).map((row) => [row.playerCode, row.points]));
      return {
        lastSeason: last,
        pointsOf: (playerCode, positions) => {
          const points = rows.get(playerCode);
          return points === undefined ? null : pointsAtMain(points, positions);
        },
      };
    }
  }
  return { lastSeason: null, pointsOf: await seasonPointsIn(ctx, leagueId, only) };
}
