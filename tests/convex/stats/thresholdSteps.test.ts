import { expect, test } from "vitest";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import type { ScoringSet } from "../../../convex/scoring/scoringSet";
import { thresholdSteps } from "../../../convex/stats/thresholdSteps";
import { HULL_SCORER, scoresLeague } from "../../support/convex/gameweekScores.harness";
import { liveRecords } from "../../support/convex/gameweekScoresMatch.harness";
import { holdTypoRule } from "../../support/convex/gameweekScoresFixes.harness";
import { HULL_EVERTON, mergedHullEverton } from "../../support/convex/matchStats.harness";
import { silenceConsoleError } from "../../support/convex/test.harness";

// The threshold lines' moments (#44; spec/10, The commentary): a live read that shows a running
// total pass a point a rule scores stores a step with the clock then, for the matchup to price.

const SET = FIRST_SCORING as ScoringSet;

test("a total passing a band or a per-number point is a step; one rising without passing any is not", () => {
  expect(thresholdSteps({ minutes: 59, saves: 2, goals_scored: 0 }, { minutes: 61, saves: 3, goals_scored: 1 }, SET)).toEqual([
    { stat: "minutes", from: 59, to: 61 },
    { stat: "saves", from: 2, to: 3 },
  ]);
  expect(thresholdSteps({ minutes: 20, saves: 3 }, { minutes: 30, saves: 4 }, SET)).toEqual([]);
});

// Every point movement, up or down, gets a line (#835; spec/10, The commentary: Craig, 31 Oct 2026).

test("his first minutes are no step, as his kick-off or coming-on line says he played; past 60 is, though one read takes him past both", () => {
  expect(thresholdSteps({ minutes: 0 }, { minutes: 1 }, SET)).toEqual([]);
  expect(thresholdSteps({ minutes: 0 }, { minutes: 30 }, SET)).toEqual([]);
  expect(thresholdSteps({ minutes: 0 }, { minutes: 61 }, SET)).toEqual([{ stat: "minutes", from: 0, to: 61 }]);
});

test("a clean sheet is a step when he has it with the minutes for it, and again when a goal takes it away", () => {
  expect(thresholdSteps({ minutes: 59, clean_sheets: 0 }, { minutes: 61, clean_sheets: 1 }, SET)).toContainEqual({ stat: "clean_sheets", from: 0, to: 1 });
  expect(thresholdSteps({ minutes: 70, clean_sheets: 1, goals_conceded: 0 }, { minutes: 71, clean_sheets: 0, goals_conceded: 1 }, SET)).toEqual([
    { stat: "clean_sheets", from: 1, to: 0 },
  ]);
  // Before his minutes reach the rule's, a clean sheet's count moves no points.
  expect(thresholdSteps({ minutes: 30, clean_sheets: 0 }, { minutes: 31, clean_sheets: 1 }, SET)).toEqual([]);
});

test("a clean sheet he now has the minutes for is a step though its count stayed 1; his minutes put back by a feed are none", () => {
  expect(thresholdSteps({ minutes: 59, clean_sheets: 1 }, { minutes: 60, clean_sheets: 1 }, SET)).toEqual([
    { stat: "minutes", from: 59, to: 60 },
    { stat: "clean_sheets", from: 1, to: 1 },
  ]);
  expect(thresholdSteps({ minutes: 60, clean_sheets: 1 }, { minutes: 59, clean_sheets: 1 }, SET)).toEqual([{ stat: "minutes", from: 60, to: 59 }]);
});

test("a total falling back past a point is a step too", () => {
  expect(thresholdSteps({ goals_conceded: 2 }, { goals_conceded: 1 }, SET)).toEqual([{ stat: "goals_conceded", from: 2, to: 1 }]);
});

test("a goal, an assist, a card or an own goal is never a step: its own line prices it", () => {
  const each = { goals_scored: 1, assists: 1, yellow_cards: 1, red_cards: 1, own_goals: 1 };
  expect(thresholdSteps({ minutes: 70 }, { minutes: 70, ...each }, SET)).toEqual([]);
  // A per-action stat no line names is: a penalty missed.
  expect(thresholdSteps({ minutes: 70 }, { minutes: 70, penalties_missed: 1 }, SET)).toEqual([{ stat: "penalties_missed", from: 0, to: 1 }]);
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
  // Past 1 minute is none: his kick-off line already says he played.
  expect(his.map(({ from, to, minutes, minute }) => ({ from, to, minutes, minute }))).toEqual([{ from: 30, to: 61, minutes: 61, minute: 61 }]);
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
