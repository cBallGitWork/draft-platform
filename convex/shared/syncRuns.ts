// Two numbers the syncs and probes share, and nothing else: how many runs each `latest` returns,
// and the batch size that footballSync and positionsSync write in. The run code is not here:
// footballSync, positionsSync, matchStats, liveStats and feeds each keep their own run table, write
// a row a run and read it back with their own `latest`.

/** How many run rows each `latest` returns. */
export const LATEST_RUNS = 5;

/** Rows per mutation, upserted or checked for a mark: well inside Convex's per-transaction limits,
 *  and a season's ~700 players in four. */
export const BATCH_SIZE = 200;
