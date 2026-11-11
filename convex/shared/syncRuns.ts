import type { Every } from "./feedSchedule";
import { DAY_MS } from "./time";

// Numbers the feeds' runs share: each sync, tick and check keeps its own run table
// (shared/feedSchedule.ts's FEED_RUN_TABLES), reads it back with its own `latest` query where it has
// one, and admin/runLogs.ts prunes them all.

/** How many run rows each `latest` returns. */
export const LATEST_RUNS = 5;

/** Rows per mutation, upserted or checked for a mark: well inside Convex's per-transaction limits,
 *  and a season's ~700 players in four. */
export const BATCH_SIZE = 200;

/** How long a run row is kept once it is not among a feed's newest `LATEST_RUNS` (Craig, 22 Oct
 *  2026, #146): a success for 30 days, a failure for 180, so an old fault stays on record. */
export const SUCCESS_KEPT_MS = 30 * DAY_MS;
export const FAILURE_KEPT_MS = 180 * DAY_MS;

/** How often `admin/runLogs:prune` clears the rows past those times (spec/20): daily, as they are
 *  counted in days. */
export const PRUNE_EVERY = { hours: 24 } as const satisfies Every;
