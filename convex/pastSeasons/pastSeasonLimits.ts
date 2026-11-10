// The past-season copy's numbers (#1113): what one call of pastSeasonLoad.ts clears or adds. No
// imports, so scripts/past-season.mjs reads them in plain Node.

/** Rows one clearing call deletes: well inside a mutation's writes. */
export const PAST_ROWS_CLEARED = 1000;

/** The most rows one adding call takes. With the roles' stats (#10) a row is at most about 910
 *  bytes of JSON (2025/26, 9 Nov 2026), so a batch is at most about 91 KB, inside the 128 KB Linux
 *  allows one command-line argument (`convex run` takes its arguments no other way) and a
 *  mutation's writes. */
export const PAST_ROWS_ADDED_MOST = 100;
