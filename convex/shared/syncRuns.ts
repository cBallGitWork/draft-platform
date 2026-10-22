// Numbers the syncs and probes share. The run code is not shared: footballSync, positionsSync,
// matchStats, liveStats and feeds each keep their own run table and read it back with their own
// `latest`.

/** How many run rows each `latest` returns. */
export const LATEST_RUNS = 5;

/** Rows per mutation, upserted or checked for a mark: well inside Convex's per-transaction limits,
 *  and a season's ~700 players in four. */
export const BATCH_SIZE = 200;
