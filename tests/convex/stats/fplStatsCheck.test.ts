import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { GAMEWEEK, HULL_KEEPER, HULL_SCORER, type ScoresLeague } from "../../support/convex/gameweekScores.harness";
import { storedLeague } from "../../support/convex/gameweekScoresMatch.harness";
import { fakeFeeds, HULL_EVERTON } from "../../support/convex/matchStats.harness";
import { CAT } from "../../support/convex/leagues.harness";
import { recordedGw6 } from "../../support/recorded/gw6.payloads";

// The first live-data check's report (#2115, spec/20 S20.13): a league's stored stats for each
// match beside FPL's own, from the recorded gameweek 6 live payload, on the scores league (Ann
// fielding Hull, Bob Everton) once Hull v Everton is final and stored.

beforeEach(() => vi.useFakeTimers());

/** The report for the league's gameweek 6, FPL's reads answered from the recording. */
async function reportOf({ t, leagueId }: ScoresLeague) {
  vi.stubGlobal("fetch", fakeFeeds(recordedGw6()));
  return t.action(internal.stats.fplStatsCheckReport.gameweek, { leagueId, gameweek: GAMEWEEK });
}

type Stats = Record<string, number>;

/** The league's stored record of `playerCode` in Hull v Everton, its stats changed as `change`
 *  says from them; its stats as they were. */
const plant = ({ t }: ScoresLeague, playerCode: number, change: (stats: Stats) => Stats) =>
  t.run(async (ctx) => {
    const row = await ctx.db
      .query("playerMatchStats")
      .withIndex("by_fixtureCode_and_playerCode", (q) => q.eq("fixtureCode", HULL_EVERTON).eq("playerCode", playerCode))
      .unique();
    await ctx.db.patch("playerMatchStats", row!._id, { stats: { ...row!.stats, ...change(row!.stats) } });
    return row!.stats;
  });

const SCORER_GOAL_GONE = () => ({ goals_scored: 0 });

test("a league whose stored stats are FPL's own lists no one", async () => {
  const report = await reportOf(await storedLeague());

  expect(report.differing).toEqual([]);
  expect(report.matching).toBeGreaterThan(0);
});

test("stored stats that differ from FPL's are listed for exactly the planted men and stats, each with both values", async () => {
  const league = await storedLeague();
  const before = await reportOf(league);
  const scorer = await plant(league, HULL_SCORER, SCORER_GOAL_GONE);
  const keeper = await plant(league, HULL_KEEPER, (stats) => ({ saves: stats.saves + 2, expected_goals_conceded: 9 }));

  const report = await reportOf(league);

  expect(scorer.goals_scored).toBe(1);
  expect(report.matching).toBe(before.matching - 2);
  expect(report.differing.map(({ playerCode, fixtureCode, stats }) => ({ playerCode, fixtureCode, stats }))).toEqual([
    { playerCode: HULL_SCORER, fixtureCode: HULL_EVERTON, stats: [{ stat: "goals_scored", fpl: 1, stored: 0 }] },
    {
      playerCode: HULL_KEEPER,
      fixtureCode: HULL_EVERTON,
      stats: [
        { stat: "expected_goals_conceded", fpl: keeper.expected_goals_conceded, stored: 9 },
        { stat: "saves", fpl: keeper.saves, stored: keeper.saves + 2 },
      ],
    },
  ]);
});

test("a man whose stored goal is gone has the league's points beside the more FPL's stats give at his slot", async () => {
  const league = await storedLeague();
  await plant(league, HULL_SCORER, SCORER_GOAL_GONE);

  const [scorer] = (await reportOf(league)).differing;

  expect(scorer).toMatchObject({ playerCode: HULL_SCORER, points: { override: null } });
  expect(scorer.points!.fromFpl! - scorer.points!.league!).toBeGreaterThan(0);
});

test("a man whose stats are FPL's but whose points the league overrode is listed for his points alone", async () => {
  const league = await storedLeague();
  const OVERRIDDEN = 40;
  await league.t.run((ctx) =>
    ctx.db.insert("pointsOverrides", { leagueId: league.leagueId, gameweek: GAMEWEEK, fixtureCode: HULL_EVERTON, playerCode: HULL_SCORER, points: OVERRIDDEN, reason: "A test", by: CAT, at: 0 }),
  );

  const { differing } = await reportOf(league);

  expect(differing).toHaveLength(1);
  expect(differing[0]).toMatchObject({ playerCode: HULL_SCORER, stats: [], points: { league: OVERRIDDEN, override: OVERRIDDEN } });
  expect(differing[0].points!.fromFpl).not.toBe(OVERRIDDEN);
});
