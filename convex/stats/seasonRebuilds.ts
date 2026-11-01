import { internal } from "../_generated/api";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { logFailure } from "../shared/errors";
import { fixtureByCode, heldSeason } from "../shared/fixtures";
import { seasonStartYear } from "../shared/time";

// The season rows' self-starts (#525, #959): a deployment holding match records from before the
// season totals (playerSeasonStats, seasonStats.ts) or season points (playerSeasonPoints,
// seasonPoints.ts) were kept starts each rebuild by itself, so Scouting never waits on someone to
// run it. Totals come first: season points start once totals show someone played, and a totals
// rebuild starts the points rebuild when it finishes. Each check starts one rebuild at most, and
// a check that can't be read is logged, naming the repair, and never stops the write it runs in.

/** How season totals are put right by hand: its last page puts season points right too. */
export const TOTALS_REBUILD_COMMAND = `npx convex run stats/seasonStats:rebuild '{"cursor":null}'`;
/** How season points are put right by hand. */
export const POINTS_REBUILD_COMMAND = `npx convex run stats/seasonPoints:rebuild '{"cursor":null}'`;

/** The match states in which every man who played has his whole record (schema/matchStats.ts). */
const WHOLE_STATES = ["complete", "locked"] as const;
/** Each state's newest match, and the one before in case the newest is the one being written. */
const NEWEST_AND_ONE_BEFORE = 2;

type SeasonTable = "playerSeasonStats" | "playerSeasonPoints";

/** Whether `table` holds a row for `season`. One read. */
async function keptIn(ctx: QueryCtx, table: SeasonTable, season: number): Promise<boolean> {
  const row = await ctx.db
    .query(table)
    .withIndex("by_season_and_playerCode", (q) => q.eq("season", season))
    .first();
  return row !== null;
}

/** Whether some match of `season` besides `writing` is complete or locked: its players' whole
 *  records are in, and someone in it played, so a totals rebuild writes a row. The newest by full
 *  time in each state is enough, as the season held is the newest. A match still provisional, or a
 *  live one the match-stats sync hasn't read, counts nothing, so records still waiting on a feed
 *  start nothing; nor does the match being written, whose own write moves its totals, so a new
 *  season's first match never starts a rebuild. */
async function wholeRecordsIn(ctx: QueryCtx, season: number, writing: number | null): Promise<boolean> {
  for (const state of WHOLE_STATES) {
    const newest = (
      await ctx.db
        .query("matchStatsStatus")
        .withIndex("by_state_and_fullTimeAt", (q) => q.eq("state", state))
        .order("desc")
        .take(NEWEST_AND_ONE_BEFORE)
    ).find(({ fixtureCode }) => fixtureCode !== writing);
    if (newest === undefined) continue;
    const fixture = await fixtureByCode(ctx, newest.fixtureCode);
    if (fixture?.kickoff != null && seasonStartYear(fixture.kickoff) === season) return true;
  }
  return false;
}

/** Runs one self-start check: true when it started a rebuild. A failure is logged, naming `repair`. */
async function checked(ctx: MutationCtx, repair: string, check: (season: number) => Promise<boolean>): Promise<boolean> {
  try {
    const season = await heldSeason(ctx);
    return season !== null && (await check(season));
  } catch (error) {
    logFailure(`the season rows weren't checked for a rebuild; run ${repair}`, error);
    return false;
  }
}

async function startTotals(ctx: MutationCtx, season: number, writing: number | null): Promise<boolean> {
  if ((await keptIn(ctx, "playerSeasonStats", season)) || !(await wholeRecordsIn(ctx, season, writing))) return false;
  await ctx.scheduler.runAfter(0, internal.stats.seasonStats.rebuild, { cursor: null });
  return true;
}

async function startPoints(ctx: MutationCtx, season: number): Promise<boolean> {
  if ((await keptIn(ctx, "playerSeasonPoints", season)) || !(await keptIn(ctx, "playerSeasonStats", season))) return false;
  await ctx.scheduler.runAfter(0, internal.stats.seasonPoints.rebuild, { cursor: null });
  return true;
}

/** Starts the season totals' rebuild when the season held has a complete match besides `writing`
 *  but no totals row. Checked by each match's record write before it moves any totals, as its own
 *  rows would hide the hole. */
export function rebuildTotalsIfNoneKept(ctx: MutationCtx, writing: number): Promise<boolean> {
  return checked(ctx, TOTALS_REBUILD_COMMAND, (season) => startTotals(ctx, season, writing));
}

/** Starts the season points' rebuild when the season held has a totals row (someone has played a
 *  whole match) but no points row. Checked by each queued re-pricing. */
export function rebuildPointsIfNoneKept(ctx: MutationCtx): Promise<boolean> {
  return checked(ctx, POINTS_REBUILD_COMMAND, (season) => startPoints(ctx, season));
}

/** Either rebuild, totals first: the one the season held is missing. Checked on each football
 *  sync's fixtures write. Seven reads at most; three once both rows are kept. */
export function rebuildIfNoneKept(ctx: MutationCtx): Promise<boolean> {
  return checked(ctx, TOTALS_REBUILD_COMMAND, async (season) => (await startTotals(ctx, season, null)) || startPoints(ctx, season));
}
