// The past-season copy's numbers (#1113): what one call of pastSeasonLoad.ts clears or adds. No
// imports, so scripts/past-season.mjs reads them in plain Node.

/** Rows one clearing call deletes: well inside a mutation's writes. */
export const PAST_ROWS_CLEARED = 1000;

/** The most rows one adding call takes. A row is about 400 bytes of JSON, so a batch is about
 *  60 KB, inside the 128 KB Linux allows one command-line argument (`convex run` takes its
 *  arguments no other way) and a mutation's writes. */
export const PAST_ROWS_ADDED_MOST = 150;
