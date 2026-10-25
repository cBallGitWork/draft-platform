import { paginationOptsValidator } from "convex/server";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { seasonStartYear } from "../football/football";
import { PLAYER_RECORDS_MOST } from "../playerCard/playerCard";
import { takeAllOrThrow } from "../shared/cappedRead";
import { addStats, sumStats, type Stats } from "./statTotals";

// Each player's season totals (#373, the playerSeasonStats table): his match records added up, so
// Scouting can sort every player by any stat with one small row a player, where adding up a
// season's records on each read would pass a query's limits by mid-season. `writeRecords`
// (matchStats.ts) keeps them in step, taking a changed record's old stats away and adding its new
// ones; `rebuild` adds every record up afresh, for the records written before the table existed.

/** The most players with totals in one season: FPL lists about 800 a season, with room. More
 *  throws, never a silent cut. */
export const SEASON_TOTALS_MOST = 1500;

/** Players `rebuild` adds up in one run: each reads his own records, a few dozen a season. */
export const REBUILD_PAGE = 25;

/** One player's record in a match: its stats as held before a write (undefined for a new one) and
 *  as written. */
export type RecordChange = { playerCode: number; fixtureCode: number; before: Stats | undefined; after: Stats };

/** The season a match falls in, by its kickoff. A record is only filed for a match the sync holds
 *  that has kicked off, so one missing either is bad data. */
async function seasonOfMatch(ctx: QueryCtx, fixtureCode: number): Promise<number> {
  const fixture = await ctx.db
    .query("fixtures")
    .withIndex("by_code", (q) => q.eq("code", fixtureCode))
    .unique();
  if (fixture === null) throw new Error(`Match ${fixtureCode} has records but isn't held`);
  if (fixture.kickoff === null) throw new Error(`Match ${fixtureCode} has records but no kickoff`);
  return seasonStartYear(fixture.kickoff);
}

function totalsRow(ctx: QueryCtx, season: number, playerCode: number) {
  return ctx.db
    .query("playerSeasonStats")
    .withIndex("by_season_and_playerCode", (q) => q.eq("season", season).eq("playerCode", playerCode))
    .unique();
}

/** Each changed record moves its player's totals for its match's season by the difference. */
export async function moveSeasonTotals(ctx: MutationCtx, changes: readonly RecordChange[]): Promise<void> {
  const seasonOf = matchSeasons(ctx);
  for (const { playerCode, fixtureCode, before, after } of changes) {
    const season = await seasonOf(fixtureCode);
    const row = await totalsRow(ctx, season, playerCode);
    const stats = addStats(addStats(row?.stats ?? {}, before ?? {}, -1), after);
    if (row === null) await ctx.db.insert("playerSeasonStats", { season, playerCode, stats });
    else await ctx.db.patch("playerSeasonStats", row._id, { stats });
  }
}

/** Every player's totals for `season`, by his code. One with none held hasn't played in it. */
export async function seasonTotals(ctx: QueryCtx, season: number): Promise<Map<number, Stats>> {
  const rows = await takeAllOrThrow(
    ctx.db.query("playerSeasonStats").withIndex("by_season_and_playerCode", (q) => q.eq("season", season)),
    SEASON_TOTALS_MOST,
    `More than ${SEASON_TOTALS_MOST} players have totals for the ${season} season, so they would be cut short`,
  );
  return new Map(rows.map((row) => [row.playerCode, row.stats]));
}

/** Sets a page of players' totals to their records added up afresh, season by season, then runs on
 *  to the next page until every player is done. Safe to run again: it sets, never adds. Run once
 *  after deploying the table: `npx convex run stats/seasonStats:rebuild '{"paginationOpts":{"numItems":25,"cursor":null}}'`. */
export const rebuild = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const page = await ctx.db.query("players").paginate(paginationOpts);
    const seasonOf = matchSeasons(ctx);
    for (const player of page.page) await rebuildPlayer(ctx, player, seasonOf);
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.stats.seasonStats.rebuild, {
        paginationOpts: { numItems: paginationOpts.numItems, cursor: page.continueCursor },
      });
    }
  },
});

/** The season of each match, each read once. */
function matchSeasons(ctx: QueryCtx): (fixtureCode: number) => Promise<number> {
  const read = new Map<number, Promise<number>>();
  return (fixtureCode) => {
    if (!read.has(fixtureCode)) read.set(fixtureCode, seasonOfMatch(ctx, fixtureCode));
    return read.get(fixtureCode)!;
  };
}

/** One player's totals, each season's set to his records in it added up. */
async function rebuildPlayer(ctx: MutationCtx, player: Doc<"players">, seasonOf: (fixtureCode: number) => Promise<number>): Promise<void> {
  const records = await takeAllOrThrow(
    ctx.db.query("playerMatchStats").withIndex("by_playerCode", (q) => q.eq("playerCode", player.code)),
    PLAYER_RECORDS_MOST,
    `More than ${PLAYER_RECORDS_MOST} match records are held for player ${player.code}, so his totals would be cut short`,
  );
  const bySeason = new Map<number, Stats[]>();
  for (const record of records) {
    const season = await seasonOf(record.fixtureCode);
    bySeason.set(season, [...(bySeason.get(season) ?? []), record.stats]);
  }
  for (const [season, each] of bySeason) {
    const stats = sumStats(each);
    const row = await totalsRow(ctx, season, player.code);
    if (row === null) await ctx.db.insert("playerSeasonStats", { season, playerCode: player.code, stats });
    else await ctx.db.replace("playerSeasonStats", row._id, { season, playerCode: player.code, stats });
  }
}
