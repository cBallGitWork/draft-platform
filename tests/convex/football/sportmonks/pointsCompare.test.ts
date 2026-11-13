// One gameweek's points from Sportmonks beside FPL's (#1422, spec/20 `S20.4`): the recorded Arsenal
// v Coventry, gameweek 1, held in both feeds and linked (#1421), each man's record in each feed,
// and the comparison lists exactly the men planted with a different stat, with the stats behind
// it. A recorded Premier League live read from Sportmonks waits for the paid trial (`S20.3`), so
// each feed's records are written here, alike but for what a test plants.

import { expect, test } from "vitest";
import { internal } from "../../../../convex/_generated/api";
import { comparePoints, statsScored } from "../../../../convex/football/sportmonks/pointsCompare";
import { FIRST_SCORING } from "../../../../convex/scoring/firstScoring";
import { GOALS, MINUTES_STAT, SAVES } from "../../../../convex/stats/matchRecords";
import { completeRecord } from "../../../support/convex/footballRows.harness";
import { bothFeedsHeld } from "../../../support/convex/sportmonks.harness";
import { freshConvex, type TestConvex } from "../../../support/convex/test.harness";
import { CLUB_CODE, FIXTURE_CODE, PLAYER_CODE } from "../../../support/recorded/fpl.payloads";
import { SM_PL } from "../../../support/recorded/sportmonks.payloads";

const RAN_AT = Date.parse("2026-11-12T06:00:00Z");
/** The recorded Arsenal v Coventry match's gameweek. */
const ARSENAL_V_COVENTRY_GAMEWEEK = 1;
const report = internal.football.sportmonks.pointsCompareReport.gameweek;

/** Sportmonks' ids for the recorded Arsenal men FPL lists too (sportmonks-pl-season.json). */
const SM_ARSENAL = { saka: SM_PL.saka, raya: 37601, saliba: 172104, jesus: 31055 } as const;
const FPL_OF = { saka: PLAYER_CODE.saka, raya: PLAYER_CODE.raya, saliba: PLAYER_CODE.saliba, jesus: PLAYER_CODE.jesus } as const;
type Man = keyof typeof SM_ARSENAL;

/** What both feeds hold each man did, before a test plants a difference. */
const ALIKE: Record<Man, Record<string, number>> = {
  saka: { [MINUTES_STAT]: 90, [GOALS]: 1 },
  raya: { [MINUTES_STAT]: 90, [SAVES]: 3 },
  saliba: { [MINUTES_STAT]: 90 },
  jesus: { [MINUTES_STAT]: 64, [GOALS]: 1 },
};

/** Both feeds held and linked, and each man's record in each: FPL's `fpl`, Sportmonks' `sportmonks`. */
async function bothRecordsHeld(t: TestConvex, sportmonks: Record<Man, Record<string, number>>, fpl = ALIKE) {
  await bothFeedsHeld(t, RAN_AT);
  await t.mutation(internal.football.sportmonks.fplLinksSync.link, { ranAt: RAN_AT });
  const men = Object.keys(SM_ARSENAL) as Man[];
  await t.run(async (ctx) => {
    for (const man of men) await ctx.db.insert("playerMatchStats", { ...completeRecord(FPL_OF[man], FIXTURE_CODE.arsenalVCoventry, fpl[man]), clubCode: CLUB_CODE.arsenal });
  });
  const records = men.map((man) => ({
    playerCode: SM_ARSENAL[man],
    fixtureCode: SM_PL.arsenalCoventry,
    clubCode: SM_PL.arsenal,
    started: true,
    played: true,
    arrived: true,
    stats: sportmonks[man],
    state: "complete" as const,
  }));
  await t.mutation(internal.football.sportmonks.sportmonksLive.writePlayerStats, { fixtureCode: SM_PL.arsenalCoventry, records });
}

test("with both feeds alike, every man's points match and nobody is listed", async () => {
  const t = freshConvex();
  await bothRecordsHeld(t, ALIKE);

  const compared = await t.query(report, { gameweek: ARSENAL_V_COVENTRY_GAMEWEEK });
  expect(compared).toMatchObject({ gameweek: ARSENAL_V_COVENTRY_GAMEWEEK, matching: 4, differing: [], unlinkedMatches: [] });
  expect(compared.matches).toEqual([{ fixtureCode: FIXTURE_CODE.arsenalVCoventry, sportmonksFixtureCode: SM_PL.arsenalCoventry, fpl: null, sportmonks: "complete" }]);
});

test("exactly the men planted with a different stat are listed, with the stat and both feeds' points; the rest are counted as matching", async () => {
  const t = freshConvex();
  await bothRecordsHeld(t, { ...ALIKE, saka: { ...ALIKE.saka, [GOALS]: 2 }, raya: { ...ALIKE.raya, [SAVES]: 6 } });

  const compared = await t.query(report, { gameweek: ARSENAL_V_COVENTRY_GAMEWEEK });
  expect(compared.matching).toBe(2);
  expect(compared.differing.map(({ fplPlayerCode, sportmonksPlayerCode, name, stats }) => ({ fplPlayerCode, sportmonksPlayerCode, name, stats }))).toEqual([
    { fplPlayerCode: PLAYER_CODE.saka, sportmonksPlayerCode: SM_PL.saka, name: "Bukayo Saka", stats: [{ stat: GOALS, fpl: 1, sportmonks: 2 }] },
    { fplPlayerCode: PLAYER_CODE.raya, sportmonksPlayerCode: SM_ARSENAL.raya, name: "David Raya Martín", stats: [{ stat: SAVES, fpl: 3, sportmonks: 6 }] },
  ]);
  for (const { points } of compared.differing) expect(points.some(({ fpl, sportmonks }) => fpl !== sportmonks)).toBe(true);
});

test("a stat the scoring doesn't read never lists a man", async () => {
  const t = freshConvex();
  await bothRecordsHeld(t, { ...ALIKE, saliba: { ...ALIKE.saliba, touches: 80 } });
  expect(await t.query(report, { gameweek: ARSENAL_V_COVENTRY_GAMEWEEK })).toMatchObject({ matching: 4, differing: [] });
});

test("a man who played in only one feed is listed; one who sat it out in the only feed that names him is not", () => {
  const set = FIRST_SCORING;
  const links = new Map([[10, 100]]);
  const played = { playerCode: 11, played: true, stats: { [MINUTES_STAT]: 20 } };
  const benched = { playerCode: 12, played: false, stats: {} };
  const onlyFpl = { playerCode: 200, played: true, stats: { [MINUTES_STAT]: 90 } };
  const compared = comparePoints(
    [{ fixtureCode: 1, fpl: [onlyFpl, { playerCode: 100, played: true, stats: { [MINUTES_STAT]: 90 } }], sportmonks: { fixtureCode: 2, records: [{ playerCode: 10, played: true, stats: { [MINUTES_STAT]: 90 } }, played, benched] } }],
    set,
    links,
    () => ["ST"],
  );
  expect(compared.matching).toBe(1);
  expect(compared.differing.map(({ fplPlayerCode, sportmonksPlayerCode }) => [fplPlayerCode, sportmonksPlayerCode])).toEqual([
    [null, played.playerCode],
    [onlyFpl.playerCode, null],
  ]);
});

test("a match that links to no Sportmonks match is named, its men not compared", () => {
  const compared = comparePoints([{ fixtureCode: 7, fpl: [{ playerCode: 1, played: true, stats: { [MINUTES_STAT]: 90 } }], sportmonks: null }], FIRST_SCORING, new Map(), () => []);
  expect(compared).toEqual({ matching: 0, differing: [], unlinkedMatches: [7] });
});

test("the stats compared are those the set's base points read, an own stat by its parts, and minutes", () => {
  const set = { ...FIRST_SCORING, ownStats: [{ stat: "own_work", name: "Work", shortCode: "WRK", parts: [{ stat: "tackles", weight: 1 }] }] };
  set.rules = [...set.rules, { ...set.rules[0], stat: "own_work" }];
  const scored = statsScored(set);
  expect(scored).toEqual(expect.arrayContaining([MINUTES_STAT, GOALS, SAVES, "tackles"]));
  expect(scored).not.toContain("own_work");
});
