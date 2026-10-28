import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { takeAllOrThrow } from "../shared/cappedRead";
import { currentFixtures, fixtureByCode } from "../shared/fixtures";

// A player's season as his records hold it: the reads the player card, the Squad tab and Compare
// share, and the cap the season totals read his records under too (seasonStats.ts).

/** The most match records one player's read takes: 38 a season, kept season on season, so ten
 *  seasons with room. More throws, never a silent cut. */
export const PLAYER_RECORDS_MOST = 500;

/** The matches the feed still sends, by code: read once a query and handed to each seasonRecords. */
export type CurrentFixtures = ReadonlyMap<number, Doc<"fixtures">>;

/** The current matches by code (shared/fixtures.ts), for seasonRecords. */
export async function currentFixturesByCode(ctx: QueryCtx): Promise<CurrentFixtures> {
  return new Map((await currentFixtures(ctx)).map((fixture) => [fixture.code, fixture]));
}

/** One of his records this season, with its match and the gameweek it was played in. */
export type SeasonRecord = { record: Doc<"playerMatchStats">; fixture: Doc<"fixtures">; gameweek: number };

/** His records this season, for whichever club, each with its match: a match the feed still sends
 *  (in `current`) is this season's, and one with no gameweek is postponed with no new date, so not
 *  yet played. An unused substitute's match is left out, as one he wasn't named for is. A record
 *  whose match isn't current is read by its code, to tell a past season's from one not held. */
export async function seasonRecords(ctx: QueryCtx, playerCode: number, current: CurrentFixtures): Promise<SeasonRecord[]> {
  const records = await takeAllOrThrow(
    ctx.db.query("playerMatchStats").withIndex("by_playerCode", (q) => q.eq("playerCode", playerCode)),
    PLAYER_RECORDS_MOST,
    `More than ${PLAYER_RECORDS_MOST} match records are held for player ${playerCode}, so his season would be cut short`,
  );
  const withMatches = await Promise.all(
    records
      .filter((record) => record.played !== false)
      .map(async (record) => {
        const fixture = current.get(record.fixtureCode) ?? (await fixtureByCode(ctx, record.fixtureCode));
        // A record is filed only for a match the sync holds, so one missing is bad data.
        if (fixture === null) throw new Error(`Player ${playerCode} has a record for match ${record.fixtureCode}, which isn't held`);
        return fixture.droppedAt !== undefined || fixture.gameweek === null ? [] : [{ record, fixture, gameweek: fixture.gameweek }];
      }),
  );
  return withMatches.flat();
}

/** The league's overrides of his points, by match: one a match at most, so never more than his
 *  records. The card and the Squad tab both read them. */
export async function overridesOf(ctx: QueryCtx, leagueId: Id<"leagues">, playerCode: number): Promise<Map<number, Doc<"pointsOverrides">>> {
  const rows = await takeAllOrThrow(
    ctx.db.query("pointsOverrides").withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId).eq("playerCode", playerCode)),
    PLAYER_RECORDS_MOST,
    `League ${leagueId} holds more than ${PLAYER_RECORDS_MOST} overrides for player ${playerCode}, so his season would be cut short`,
  );
  return new Map(rows.map((row) => [row.fixtureCode, row]));
}
