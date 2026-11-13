import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { basePoints, cardOpensAt, pointsAtEveryPosition } from "../playerCard/cardPoints";
import type { Position } from "../positions/positionTables";
import type { StoredScoringSet } from "../scoring/scoringSetShape";
import { siteScoringByGameweek } from "../scoring/siteVersions";
import { inTenths } from "../scoring/values";
import { takeAllOrThrow } from "../shared/cappedRead";
import { fixtureByCode, heldFixturesSeason } from "../shared/fixtures";
import { groupedBy } from "../shared/groupedBy";
import { readOnce } from "../shared/readOnce";
import { isWhole, SEASON_PLAYERS_MOST, statsIfWhole } from "./matchRecords";
import { eachPlayerPage, seasonRowOf } from "./seasonRebuilds";
import { isPlayedThisSeason, seasonRecords, type FixtureReader } from "./seasonRecords";
import { seasonOfFixture } from "./seasonStats";

// Each player's season points on Scouting (#525; spec/19, The players list): the total his card
// shows in the league, whoever held him: each match his card lists this season (seasonRecords.ts)
// at his base points at his main position, under the site's set in force that gameweek, or the
// league's override. Pricing every player's season on each list read would pass a query's limits
// by mid-season, so the site-wide part is kept, a row a player and season summed at every
// position, set afresh just after a record write or a match's move changes what he counts
// (seasonPointsQueue.ts). Overrides are few, so they go in on each read. Last season's under the set as it
// stands, shown before the first match, are scouting/shownSeasonPoints.ts's (#956).

/** The most overrides one league holds across every season: a commissioner corrects a feed's
 *  mistake a handful of times a season, so this is decades of them. More throws, never a silent
 *  cut. Claude's choice, not yet Craig's. */
export const LEAGUE_OVERRIDES_MOST = 1000;

type SetIn = (gameweek: number) => StoredScoringSet;

/** His base points in one match at `position`, or null while his whole record hasn't arrived. */
export const matchPointsAt = (record: Doc<"playerMatchStats">, set: StoredScoringSet, position: Position) =>
  basePoints(statsIfWhole(record), set, [position])[0].total;

/** Sets these players' rows for the season of the matches held (heldFixturesSeason) afresh from their
 *  records, each match read once: a row while any of his records there is whole, none before. Only
 *  that season's row is read, so a match that left the feed or moved comes off at the next refresh,
 *  and last season's rows are left as they were. */
async function refreshSeasonPoints(ctx: MutationCtx, playerCodes: Iterable<number>): Promise<void> {
  const codes = [...new Set(playerCodes)];
  const season = await heldFixturesSeason(ctx);
  if (codes.length === 0 || season === null) return;
  const setIn = await siteScoringByGameweek(ctx);
  const fixtureOf = readOnce((code: number) => fixtureByCode(ctx, code));
  for (const playerCode of codes) {
    const inSeason = (await seasonRecords(ctx, playerCode, fixtureOf)).filter(({ fixture }) => seasonOfFixture(fixture) === season);
    const row = await seasonRowOf(ctx, "playerSeasonPoints", season, playerCode);
    if (!inSeason.some(({ record }) => isWhole(record))) {
      if (row !== null) await ctx.db.delete("playerSeasonPoints", row._id);
      continue;
    }
    const kept = { season, playerCode, points: pointsAtEveryPosition(inSeason.map(({ record, gameweek }) => ({ stats: statsIfWhole(record), set: setIn(gameweek) }))) };
    if (row === null) await ctx.db.insert("playerSeasonPoints", kept);
    else await ctx.db.replace("playerSeasonPoints", row._id, kept);
  }
}

/** Whether any player has points in `season`: from its first priced match on. */
export async function seasonPriced(ctx: QueryCtx, season: number): Promise<boolean> {
  return (await ctx.db.query("playerSeasonPoints").withIndex("by_season_and_playerCode", (q) => q.eq("season", season)).first()) !== null;
}

/** A player's season points, by his code and his positions now. */
export type SeasonPointsOf = (playerCode: number, positions: readonly Position[]) => number | null;

/** Each player's season points in the league: a reader taking his code and his positions now, which
 *  gives the sum of his card's matches this season, overrides in, to tenths as the table keeps
 *  them, or null ("—") while none of his matches is priced or overridden. `only` reads just those
 *  players' rows; without it, every player's, as the list needs. The league's overrides are
 *  read whole either way: a handful a season. */
export async function seasonPointsIn(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  only?: readonly number[],
): Promise<SeasonPointsOf> {
  const season = await heldFixturesSeason(ctx);
  if (season === null) return () => null;
  const sums = await sumsIn(ctx, season, only);
  const overrides = await overridesIn(ctx, leagueId, season, only);
  return (playerCode, positions) => {
    const position = cardOpensAt(positions);
    const his = overrides.get(playerCode) ?? [];
    const sum = sums.get(playerCode);
    if (position === null || (sum === undefined && his.length === 0)) return null;
    const base = sum?.[position] ?? 0;
    return inTenths(his.reduce((total, { points, pricedAt }) => total + points - (pricedAt(position) ?? 0), base));
  };
}

/** The season's rows, by player: every player's, or only these. */
async function sumsIn(ctx: QueryCtx, season: number, only: readonly number[] | undefined): Promise<Map<number, Record<string, number>>> {
  const rows =
    only === undefined
      ? await takeAllOrThrow(
          ctx.db.query("playerSeasonPoints").withIndex("by_season_and_playerCode", (q) => q.eq("season", season)),
          SEASON_PLAYERS_MOST,
          `More than ${SEASON_PLAYERS_MOST} players have season points for the ${season} season, so they would be cut short`,
        )
      : (await Promise.all(only.map((code) => seasonRowOf(ctx, "playerSeasonPoints", season, code)))).filter((row) => row !== null);
  return new Map(rows.map((row) => [row.playerCode, row.points]));
}

/** One override this season: its points, and what his record there gives at a position. */
type HeldOverride = { points: number; pricedAt: (position: Position) => number | null };

/** The league's overrides of matches his card lists this season (seasonRecords.ts's rules: a match
 *  the feed still sends, with a gameweek, that he played in), by player. */
async function overridesIn(ctx: QueryCtx, leagueId: Id<"leagues">, season: number, only: readonly number[] | undefined): Promise<Map<number, HeldOverride[]>> {
  const held = await takeAllOrThrow(
    ctx.db.query("pointsOverrides").withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId)),
    LEAGUE_OVERRIDES_MOST,
    `League ${leagueId} holds more than ${LEAGUE_OVERRIDES_MOST} overrides, so season points would be cut short`,
  );
  const wanted = only === undefined ? null : new Set(only);
  const rows = wanted === null ? held : held.filter((row) => wanted.has(row.playerCode));
  if (rows.length === 0) return new Map();
  const setIn = await siteScoringByGameweek(ctx);
  const fixtureOf = readOnce((code: number) => fixtureByCode(ctx, code));
  const counted = (await Promise.all(rows.map((row) => heldOverride(ctx, row, season, setIn, fixtureOf)))).filter((each) => each !== null);
  return groupedBy(counted, ({ playerCode }) => playerCode);
}

/** The override as it counts this season, or null for a match his card doesn't list this season. */
async function heldOverride(ctx: QueryCtx, override: Doc<"pointsOverrides">, season: number, setIn: SetIn, fixtureOf: FixtureReader) {
  const { fixtureCode, playerCode, points } = override;
  const fixture = await fixtureOf(fixtureCode);
  if (fixture === null || !isPlayedThisSeason(fixture) || seasonOfFixture(fixture) !== season) return null;
  const record = await ctx.db
    .query("playerMatchStats")
    .withIndex("by_fixtureCode_and_playerCode", (q) => q.eq("fixtureCode", fixtureCode).eq("playerCode", playerCode))
    .unique();
  if (record === null || record.played === false) return null;
  const set = setIn(fixture.gameweek);
  return { playerCode, points, pricedAt: (position: Position) => matchPointsAt(record, set, position) };
}

/** Sets these players' rows afresh, PLAYERS_PAGE at most: queued by seasonPointsQueue.ts. */
export const refresh = internalMutation({
  args: { playerCodes: v.array(v.number()) },
  returns: v.null(),
  handler: async (ctx, { playerCodes }) => {
    await refreshSeasonPoints(ctx, playerCodes);
    return null;
  },
});

/** Sets a page of players' rows, from `cursor` (null for the first), afresh from their records,
 *  then runs on to the next page until every player is done. Safe to run again: it sets, never
 *  adds. Started by itself on a deployment holding records but no row, and after a season totals
 *  rebuild (seasonRebuilds.ts), and by hand with its POINTS_REBUILD_COMMAND. */
export const rebuild = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    await eachPlayerPage(ctx, cursor, (playerCodes) => refreshSeasonPoints(ctx, playerCodes), internal.stats.seasonPoints.rebuild);
    return null;
  },
});
