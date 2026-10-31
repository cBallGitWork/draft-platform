import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { takeAllOrThrow } from "../shared/cappedRead";
import { gameweekFixtures } from "../shared/fixtures";
import { statusOf } from "../stats/matchStats";

// The gameweek's matches as held, for the scorer (teamGameweek.ts) and the screens that read them:
// each match's state, its records and the league's overrides in it, and the predicates on them.
// Plain helpers: no Convex function lives here.

type PlayerCode = number;

/** The most records one match holds: one for each man two team sheets name, about forty. More
 *  throws, never a silent cut. */
export const MATCH_RECORDS_MOST = 80;

/** One of the gameweek's matches as held: its state, if read at full time, its records, and the
 *  league's overrides of men's points in it (#32). */
export interface HeldMatch {
  fixture: Doc<"fixtures">;
  status: Doc<"matchStatsStatus"> | null;
  records: Map<PlayerCode, Doc<"playerMatchStats">>;
  overrides: Map<PlayerCode, number>;
}

/** The match's records, every one: more than MATCH_RECORDS_MOST throws, saying what of the match's
 *  (`why`) would be cut short. */
export function matchRecordsOf(ctx: QueryCtx, fixtureCode: number, why: string): Promise<Doc<"playerMatchStats">[]> {
  return takeAllOrThrow(
    ctx.db.query("playerMatchStats").withIndex("by_fixtureCode_and_playerCode", (q) => q.eq("fixtureCode", fixtureCode)),
    MATCH_RECORDS_MOST,
    `Match ${fixtureCode} holds more than ${MATCH_RECORDS_MOST} records, so ${why} would be cut short`,
  );
}

/** The gameweek's fixtures the feed still sends. */
export function heldFixtures(ctx: QueryCtx, gameweek: number): Promise<Doc<"fixtures">[]> {
  return gameweekFixtures(ctx, gameweek, "its points would be cut short");
}

/** The fixtures' matches, each with its state, its records and the league's overrides in it. */
export async function heldMatches(ctx: QueryCtx, leagueId: Id<"leagues">, fixtures: readonly Doc<"fixtures">[]): Promise<HeldMatch[]> {
  return Promise.all(
    fixtures.map(async (fixture) => {
      const rows = await matchRecordsOf(ctx, fixture.code, "its points");
      return {
        fixture,
        status: await statusOf(ctx, fixture.code),
        records: new Map(rows.map((row) => [row.playerCode, row])),
        overrides: await overridesIn(ctx, leagueId, fixture.code),
      };
    }),
  );
}

/** The most overrides a league holds in one match: one a man, as many as the records allow. More
 *  throws, never a silent cut. */
export const MATCH_OVERRIDES_MOST = MATCH_RECORDS_MOST;

/** The league's overrides of men's points in the match (#32), by player. */
export async function overridesIn(ctx: QueryCtx, leagueId: Id<"leagues">, fixtureCode: number): Promise<Map<PlayerCode, number>> {
  const rows = await takeAllOrThrow(
    ctx.db
      .query("pointsOverrides")
      .withIndex("by_leagueId_and_fixtureCode_and_playerCode", (q) => q.eq("leagueId", leagueId).eq("fixtureCode", fixtureCode)),
    MATCH_OVERRIDES_MOST,
    `League ${leagueId} holds more than ${MATCH_OVERRIDES_MOST} overrides in match ${fixtureCode}, so its points would be cut short`,
  );
  return new Map(rows.map((row) => [row.playerCode, row.points]));
}

export const playsIn = (fixture: Doc<"fixtures">, clubCode: number) => fixture.homeClubCode === clubCode || fixture.awayClubCode === clubCode;

/** A match read at full time has a state; one still live has none (liveStats.ts). */
export const isFinished = (match: HeldMatch) => match.status !== null;
/** Its corrections window shut: nothing changes its points after (spec/07). */
export const isMatchFinal = (match: Pick<HeldMatch, "status">) => match.status?.state === "locked";
