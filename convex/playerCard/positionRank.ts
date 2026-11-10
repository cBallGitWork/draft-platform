import { v, type Infer } from "convex/values";
import { query } from "../_generated/server";
import { slotPosition } from "../lineup/pitchShape";
import { positionsNow } from "../positions/playerPositions";
import { currentPlayersOf } from "../scouting/playersList";
import { shownSeasonPoints } from "../scouting/shownSeasonPoints";
import { memberOf } from "../shared/leagueAccess";
import { currentClubs } from "../shared/players";

// His rank at the position the card's switch is on (spec/12 S12.1; Craig, 9 Nov 2026, on #1027:
// "ranked by base points this season against every player holding that position (owned or free),
// as Scouting totals them, ties sharing a place", "4th of 112 MID"). Each player is totalled at
// that position, so a two-position player is ranked on what the card's figure shows there. Its own
// query, apart from the card's, so the card doesn't re-run whenever any player's points move.

const positionRank = v.object({
  /** His place, 1 for the most points, a tie sharing the higher place; null while he has no
   *  points (Scouting's "—") or isn't a current Premier League player holding the position. */
  place: v.union(v.number(), v.null()),
  /** Every current player holding the position. */
  of: v.number(),
});
export type PositionRank = Infer<typeof positionRank>;

/** His rank at `position` among every current player holding it, by the season points Scouting
 *  shows (shownSeasonPoints.ts: last season's before the new season's first match is priced),
 *  totalled at that position. Anyone not in the league is refused. */
export const atPosition = query({
  args: { leagueId: v.id("leagues"), playerCode: v.number(), position: slotPosition },
  returns: positionRank,
  handler: async (ctx, { leagueId, playerCode, position }) => {
    await memberOf(ctx, leagueId);
    const players = await currentPlayersOf(ctx, await currentClubs(ctx));
    const positionsOf = await positionsNow(ctx, leagueId);
    const { pointsOf } = await shownSeasonPoints(ctx, leagueId);
    const holding = await Promise.all(players.map(async ({ code }) => ({ code, holds: (await positionsOf(code)).includes(position) })));
    const points = holding.filter(({ holds }) => holds).map(({ code }) => ({ code, points: pointsOf(code, [position]) }));
    return { place: placeOf(points, playerCode), of: points.length };
  },
});

/** His place among these players' points, ties sharing the higher place: one more than how many
 *  have more. Null when he isn't among them or has no points. */
export function placeOf(players: readonly { code: number; points: number | null }[], playerCode: number): number | null {
  const his = players.find(({ code }) => code === playerCode)?.points ?? null;
  if (his === null) return null;
  return 1 + players.filter(({ points }) => points !== null && points > his).length;
}
