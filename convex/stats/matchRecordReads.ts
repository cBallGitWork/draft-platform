import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { takeAllOrThrow } from "../shared/cappedRead";

// A match's records as held, read whole: the one read the stat writes (matchStats.ts, liveStats.ts),
// the scorer (heldMatches.ts) and the screens share (#1725). Plain helpers: no Convex function lives
// here, and nothing it imports reads back, so every one of those can import it without a loop.

/** The most records one match holds: one for each man two team sheets name, about forty. More
 *  throws, never a silent cut. */
export const MATCH_RECORDS_MOST = 80;

/** The match's records, every one: more than MATCH_RECORDS_MOST throws, saying what of the match's
 *  (`why`) would be cut short. */
export function matchRecordsOf(ctx: QueryCtx, fixtureCode: number, why: string): Promise<Doc<"playerMatchStats">[]> {
  return takeAllOrThrow(
    ctx.db.query("playerMatchStats").withIndex("by_fixtureCode_and_playerCode", (q) => q.eq("fixtureCode", fixtureCode)),
    MATCH_RECORDS_MOST,
    `Match ${fixtureCode} holds more than ${MATCH_RECORDS_MOST} records, so ${why} would be cut short`,
  );
}
