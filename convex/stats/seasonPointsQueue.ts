import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { PLAYERS_PAGE, statChanges, type PlayerMatchRecord } from "./matchRecords";
import { countedStats } from "./seasonStats";
import { rebuildPointsIfNoneKept } from "./seasonRebuilds";

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

/** Queues these players' re-pricing, PLAYERS_PAGE a job so each stays well inside a mutation's
 *  reads; or, while no row is kept though records are, the whole rebuild instead
 *  (seasonRebuilds.ts). */
export async function queueRefresh(ctx: MutationCtx, playerCodes: Iterable<number>): Promise<void> {
  const codes = [...new Set(playerCodes)];
  if (codes.length === 0 || (await rebuildPointsIfNoneKept(ctx))) return;
  for (let start = 0; start < codes.length; start += PLAYERS_PAGE) {
    await ctx.scheduler.runAfter(0, internal.stats.seasonPoints.refresh, { playerCodes: codes.slice(start, start + PLAYERS_PAGE) });
  }
}
