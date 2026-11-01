import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { takeAllOrThrow } from "../shared/cappedRead";
import { fixtureByCode } from "../shared/fixtures";
import { PLAYER_RECORDS_MOST } from "./matchRecords";

// A player's match records this season, each with its match: the matches his card lists
// (scoredMatches.ts), the two players Scouting compares (compare.ts) and his season points
// (seasonPoints.ts) all read his season from here, so all three count the same matches.

/** One of his records this season, with its match and the gameweek it was played in. */
export type SeasonRecord = { record: Doc<"playerMatchStats">; fixture: Doc<"fixtures">; gameweek: number };

/** Reads a match by its code, or null while the football sync holds none: `fixtureByCode`, or one
 *  that reads each match once across many players. */
export type FixtureReader = (code: number) => Promise<Doc<"fixtures"> | null>;

/** His records, every season's. More than PLAYER_RECORDS_MOST throws, its message ending in
 *  `why`: what the caller would cut short. */
export function playerRecords(ctx: QueryCtx, playerCode: number, why: string): Promise<Doc<"playerMatchStats">[]> {
  return takeAllOrThrow(
    ctx.db.query("playerMatchStats").withIndex("by_playerCode", (q) => q.eq("playerCode", playerCode)),
    PLAYER_RECORDS_MOST,
    `More than ${PLAYER_RECORDS_MOST} match records are held for player ${playerCode}, so ${why} would be cut short`,
  );
}

/** A match the feed still sends is this season's, and one with no gameweek is postponed with no
 *  new date, so not yet played. */
export const isPlayedThisSeason = (fixture: Doc<"fixtures">): fixture is Doc<"fixtures"> & { gameweek: number } =>
  fixture.droppedAt === undefined && fixture.gameweek !== null;

/** His records this season, for whichever club, each with its match: a match the feed still sends
 *  is this season's (isPlayedThisSeason). An unused substitute's match is left out, as one he
 *  wasn't named for is. */
export async function seasonRecords(ctx: QueryCtx, playerCode: number, fixtureOf?: FixtureReader): Promise<SeasonRecord[]> {
  return seasonRecordsOf(ctx, playerCode, await playerRecords(ctx, playerCode, "his season"), fixtureOf);
}

/** `seasonRecords` from his records already read. */
export async function seasonRecordsOf(
  ctx: QueryCtx,
  playerCode: number,
  records: readonly Doc<"playerMatchStats">[],
  fixtureOf: FixtureReader = (code) => fixtureByCode(ctx, code),
): Promise<SeasonRecord[]> {
  const withMatches = await Promise.all(
    records
      .filter((record) => record.played !== false)
      .map(async (record) => {
        const fixture = await fixtureOf(record.fixtureCode);
        // A record is filed only for a match the sync holds, so one missing is bad data.
        if (fixture === null) throw new Error(`Player ${playerCode} has a record for match ${record.fixtureCode}, which isn't held`);
        return isPlayedThisSeason(fixture) ? [{ record, fixture, gameweek: fixture.gameweek }] : [];
      }),
  );
  return withMatches.flat();
}
