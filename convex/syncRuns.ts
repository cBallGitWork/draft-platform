// Two constants the syncs and probes share: how many runs each `latest` returns (footballSync,
// positionsSync, matchStats, liveStats and feeds each keep a row a run) and the batch size.

/** How many run rows each `latest` returns. */
export const LATEST_RUNS = 5;

/** Rows per mutation, upserted or checked for a mark: well inside Convex's per-transaction limits,
 *  and a season's ~700 players in four. */
export const BATCH_SIZE = 200;
