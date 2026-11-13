import { v } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
import { internalQuery, type QueryCtx } from "../../_generated/server";
import { matchStatsState } from "../../schema";
import { EVERY_LEAGUE } from "../../positions/positionSettings";
import { positionsNow } from "../../positions/playerPositions";
import type { Position } from "../../positions/positionTables";
import { siteScoringInGameweek } from "../../scoring/siteVersions";
import { takeAllOrThrow } from "../../shared/cappedRead";
import { gameweekFixtures } from "../../shared/fixtures";
import { MATCH_RECORDS_MOST, matchRecordsOf } from "../../stats/matchRecordReads";
import { statsIfWhole } from "../../stats/matchRecords";
import { comparePoints, type ComparedMatch, type FeedRecord } from "./pointsCompare";

// The comparison of one gameweek's points read from what is stored (#1422, spec/20 `S20.4`): FPL's
// matches that gameweek, each one's records from the FPL and Premier League feeds, and the linked
// Sportmonks match's (#1415, #1421), priced under the site's scoring in force that gameweek by
// pointsCompare.ts. Until the admin dashboard has a picture with a place for it, Craig reads it
// from the CLI:
// `npx convex run football/sportmonks/pointsCompareReport:gameweek '{"gameweek":…}'`.

const feedPoints = v.union(v.number(), v.null());

const differingMan = v.object({
  fixtureCode: v.number(),
  fplPlayerCode: v.union(v.number(), v.null()),
  sportmonksPlayerCode: v.union(v.number(), v.null()),
  /** His name as FPL holds it, or Sportmonks where he links to no FPL man. */
  name: v.string(),
  points: v.array(v.object({ position: v.string(), fpl: feedPoints, sportmonks: feedPoints })),
  stats: v.array(v.object({ stat: v.string(), fpl: feedPoints, sportmonks: feedPoints })),
});

const matchState = v.union(matchStatsState, v.null());

/** Every man's points in one gameweek from both feeds: how many match, every man whose points
 *  differ with the stats behind it, and each match's state in both feeds, so a provisional one
 *  isn't read as final. */
export const gameweek = internalQuery({
  args: { gameweek: v.number() },
  returns: v.object({
    gameweek: v.number(),
    matching: v.number(),
    differing: v.array(differingMan),
    unlinkedMatches: v.array(v.number()),
    matches: v.array(v.object({ fixtureCode: v.number(), sportmonksFixtureCode: v.union(v.number(), v.null()), fpl: matchState, sportmonks: matchState })),
  }),
  handler: async (ctx, { gameweek }) => {
    const why = `gameweek ${gameweek}'s points comparison would be cut short`;
    const fixtures = await gameweekFixtures(ctx, gameweek, why);
    const links = new Map<number, number>();
    const matches: ComparedMatch[] = [];
    const states = [];
    for (const { code } of fixtures) {
      const fpl = await matchRecordsOf(ctx, code, why);
      const sportmonksCode = await sportmonksMatchOf(ctx, code);
      const sportmonks = sportmonksCode === null ? [] : await sportmonksRecordsOf(ctx, sportmonksCode, why);
      for (const { playerCode } of sportmonks) {
        const fplCode = await fplCodeOf(ctx, playerCode);
        if (fplCode !== null) links.set(playerCode, fplCode);
      }
      matches.push({
        fixtureCode: code,
        fpl: fpl.map(feedRecord),
        sportmonks: sportmonksCode === null ? null : { fixtureCode: sportmonksCode, records: sportmonks.map(sportmonksFeedRecord) },
      });
      const fplState = await ctx.db
        .query("matchStatsStatus")
        .withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", code))
        .unique();
      states.push({ fixtureCode: code, sportmonksFixtureCode: sportmonksCode, fpl: fplState?.state ?? null, sportmonks: sportmonks[0]?.state ?? null });
    }

    const positionsOf = await positionsNow(ctx, EVERY_LEAGUE);
    const positions = new Map<number, Position[]>();
    for (const code of new Set([...links.values(), ...matches.flatMap(({ fpl }) => fpl.map(({ playerCode }) => playerCode))])) {
      positions.set(code, await positionsOf(code));
    }
    const set = await siteScoringInGameweek(ctx, gameweek);
    const comparison = comparePoints(matches, set, links, (code) => positions.get(code) ?? []);
    const differing = [];
    for (const man of comparison.differing) differing.push({ ...man, name: await nameOf(ctx, man.fplPlayerCode, man.sportmonksPlayerCode) });
    return { gameweek, matching: comparison.matching, differing, unlinkedMatches: comparison.unlinkedMatches, matches: states };
  },
});

const feedRecord = (record: Doc<"playerMatchStats">): FeedRecord => ({ playerCode: record.playerCode, played: record.played, stats: statsIfWhole(record) });

/** A Sportmonks record's stats once he sat it out or his `lineups.details` arrived, as an FPL
 *  record's are once whole. */
const sportmonksFeedRecord = (record: Doc<"sportmonksPlayerMatchStats">): FeedRecord => ({
  playerCode: record.playerCode,
  played: record.played,
  stats: !record.played || record.arrived ? record.stats : null,
});

function sportmonksRecordsOf(ctx: QueryCtx, fixtureCode: number, why: string) {
  return takeAllOrThrow(
    ctx.db.query("sportmonksPlayerMatchStats").withIndex("by_fixtureCode_and_playerCode", (q) => q.eq("fixtureCode", fixtureCode)),
    MATCH_RECORDS_MOST,
    `Sportmonks' match ${fixtureCode} holds more than ${MATCH_RECORDS_MOST} records, so ${why}`,
  );
}

/** The Sportmonks match linked to FPL's match `fplCode`, null for none. */
async function sportmonksMatchOf(ctx: QueryCtx, fplCode: number): Promise<number | null> {
  const link = await ctx.db
    .query("sportmonksFplLinks")
    .withIndex("by_kind_and_fplCode", (q) => q.eq("kind", "match").eq("fplCode", fplCode))
    .first();
  return link?.code ?? null;
}

/** FPL's code for a Sportmonks player, null while he links to none. */
async function fplCodeOf(ctx: QueryCtx, playerCode: number): Promise<number | null> {
  const link = await ctx.db
    .query("sportmonksFplLinks")
    .withIndex("by_kind_and_code", (q) => q.eq("kind", "player").eq("code", playerCode))
    .unique();
  return link?.fplCode ?? null;
}

async function nameOf(ctx: QueryCtx, fplCode: number | null, sportmonksCode: number | null): Promise<string> {
  const fpl = fplCode === null ? null : await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", fplCode)).first();
  if (fpl !== null) return fpl.fullName;
  const sportmonks = sportmonksCode === null ? null : await ctx.db.query("sportmonksPlayers").withIndex("by_code", (q) => q.eq("code", sportmonksCode)).first();
  return sportmonks?.fullName ?? `Unknown player ${fplCode ?? sportmonksCode}`;
}
