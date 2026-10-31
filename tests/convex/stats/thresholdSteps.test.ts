import { expect, test } from "vitest";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import type { ScoringSet } from "../../../convex/scoring/scoringSet";
import { thresholdSteps } from "../../../convex/stats/thresholdSteps";
import { holdTypoRule, HULL_SCORER, liveRecords, scoresLeague } from "../../support/convex/gameweekScores.harness";
import { HULL_EVERTON, mergedHullEverton } from "../../support/convex/matchStats.harness";
import { silenceConsoleError } from "../../support/convex/test.harness";

// The threshold lines' moments (#44; spec/10, The commentary): a live read that shows a running
// total pass a point a rule scores stores a step with the clock then, for the matchup to price.

const SET = FIRST_SCORING as ScoringSet;

test("a total passing a band or a per-number point is a step; one rising without passing any, or a per-action stat, is not", () => {
  expect(thresholdSteps({ minutes: 59, saves: 2, goals_scored: 0 }, { minutes: 61, saves: 3, goals_scored: 1 }, SET)).toEqual([
    { stat: "minutes", from: 59, to: 61 },
    { stat: "saves", from: 2, to: 3 },
  ]);
  expect(thresholdSteps({ minutes: 20, saves: 3 }, { minutes: 30, saves: 4 }, SET)).toEqual([]);
});

test("a point only one slot's pricing scores is a step, for the matchup to price for whoever stands there", () => {
  // Goals conceded take a point off only the keeper and the defence: still a step for every man.
  expect(thresholdSteps({ goals_conceded: 1 }, { goals_conceded: 2 }, SET)).toEqual([{ stat: "goals_conceded", from: 1, to: 2 }]);
});

test("an own stat is stepped by its own total", () => {
  const set: ScoringSet = {
    ...SET,
    ownStats: [{ stat: "defending", name: "Defending", shortCode: "DF", parts: [{ stat: "tackles", weight: 1 }, { stat: "clearances", weight: 0.5 }] }],
    rules: [{ shape: "perCount", stat: "defending", values: { all: { every: 3, points: 1 } } }],
  };
  expect(thresholdSteps({ tackles: 2 }, { tackles: 2, clearances: 2 }, set)).toEqual([{ stat: "defending", from: 2, to: 3 }]);
});

test("each live read stores the steps its records show over the last, with the clock then", async () => {
  const league = await scoresLeague();
  const records = mergedHullEverton();
  const at = (minutes: number) => records.map((record) => (record.playerCode === HULL_SCORER ? { ...record, stats: { ...record.stats, minutes } } : record));

  await liveRecords(league, at(30), 30);
  await liveRecords(league, at(30), 31);
  await liveRecords(league, at(61), 61);

  const steps = await league.t.run((ctx) => ctx.db.query("thresholdSteps").collect());
  const his = steps.filter((step) => step.playerCode === HULL_SCORER && step.fixtureCode === HULL_EVERTON && step.stat === "minutes");
  expect(his.map(({ from, to, minutes, minute }) => ({ from, to, minutes, minute }))).toEqual([
    { from: 0, to: 30, minutes: 30, minute: 30 },
    { from: 30, to: 61, minutes: 61, minute: 61 },
  ]);
});

test("a site set that can't be read stores no steps, logs why, and the records are still written", async () => {
  const league = await scoresLeague();
  await holdTypoRule(league);
  const logged = silenceConsoleError();
  const { thresholdSteps } = await liveRecords(league, mergedHullEverton(), 30);
  expect(logged).toHaveBeenCalledWith(expect.stringContaining(`match ${HULL_EVERTON}'s threshold steps weren't stored`));
  // Handed back for the threshold lines feed's row (#522), so the feeds page and the admin hear.
  expect(thresholdSteps).toMatchObject({ fixtureCode: HULL_EVERTON, ok: false, error: expect.any(String) });
  expect(await league.t.run((ctx) => ctx.db.query("thresholdSteps").collect())).toEqual([]);
  expect(await league.t.run((ctx) => ctx.db.query("playerMatchStats").collect())).toHaveLength(mergedHullEverton().length);
});
