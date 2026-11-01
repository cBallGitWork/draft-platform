import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { statChanges, type PlayerMatchRecord } from "./matchRecords";
import { heldSeason } from "../shared/fixtures";
import { countedStats, REBUILD_PAGE } from "./seasonStats";

// When season points are re-priced (#525, seasonPoints.ts): just after a record write changes what
// a player counts, or a played match leaves the feed or moves gameweek (footballSync.ts). Each runs
// as its own job, so a scoring set that can't be read never stops a record or a match being
// written; a failed job shows in Convex's logs, and the next write or a rebuild puts it right.

/** Whether writing `sent` over `held` (undefined for a new record) changes what his season points
 *  count: his counted stats, or whether he played, as an unused substitute's match isn't his card's.
 *  A live record moving before it is whole doesn't. */
export function changesSeasonPoints(held: PlayerMatchRecord | Doc<"playerMatchStats"> | undefined, sent: PlayerMatchRecord): boolean {
  if (held === undefined) return Object.keys(countedStats(sent)).length > 0;
  return held.played !== sent.played || statChanges(countedStats(held), countedStats(sent)).length > 0;
}

/** Re-prices each player whose record `records` changes over the `held` ones. */
export function repriceChanged(ctx: MutationCtx, records: readonly PlayerMatchRecord[], held: ReadonlyMap<number, Doc<"playerMatchStats">>) {
  return queueRefresh(
    ctx,
    records.filter((record) => changesSeasonPoints(held.get(record.playerCode), record)).map(({ playerCode }) => playerCode),
  );
}

/** Queues these players' re-pricing, REBUILD_PAGE a job so each stays well inside a mutation's
 *  reads; or, while no row is kept though records are, the whole rebuild instead. */
export async function queueRefresh(ctx: MutationCtx, playerCodes: Iterable<number>): Promise<void> {
  const codes = [...new Set(playerCodes)];
  if (codes.length === 0 || (await rebuildIfNoneKept(ctx))) return;
  for (let start = 0; start < codes.length; start += REBUILD_PAGE) {
    await ctx.scheduler.runAfter(0, internal.stats.seasonPoints.refresh, { playerCodes: codes.slice(start, start + REBUILD_PAGE) });
  }
}

/** Starts the rebuild when, for the season of the matches held, some player has played a whole
 *  match (his season totals hold a row, seasonStats.ts) but none has a points row: a deployment
 *  with records from before the rows were kept (#525), so Scouting never waits on someone to run
 *  it. Records still waiting on a feed, or only unused substitutes', start nothing, as the rebuild
 *  would write no row and be started again. Checked on each football sync and each queued
 *  re-pricing; true when it started it. Three reads. */
export async function rebuildIfNoneKept(ctx: MutationCtx): Promise<boolean> {
  const season = await heldSeason(ctx);
  if (season === null) return false;
  const inSeason = (table: "playerSeasonPoints" | "playerSeasonStats") =>
    ctx.db
      .query(table)
      .withIndex("by_season_and_playerCode", (q) => q.eq("season", season))
      .first();
  if ((await inSeason("playerSeasonPoints")) !== null || (await inSeason("playerSeasonStats")) === null) return false;
  await ctx.scheduler.runAfter(0, internal.stats.seasonPoints.rebuild, { cursor: null });
  return true;
}
