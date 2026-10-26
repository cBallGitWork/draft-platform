import { describe, expect, test } from "vitest";
import type { StoredScoringSet } from "../../../convex/rules/leagueRulesShape";
import { scoringChanges } from "../../../convex/scoring/patchChanges";

// What the patch notes and a version's letter say changed (spec/14, Changes and corrections;
// #356): worked out from two stored sets, one line a change, each position named only where its
// points moved.

type Rule = StoredScoringSet["rules"][number];

const set = (rules: Rule[], rest: Partial<StoredScoringSet> = {}): StoredScoringSet => ({ rules, wholePointsOnly: false, ...rest });
const assists = (value: number): Rule => ({ shape: "perAction", stat: "assists", values: { all: value } });
const GOALS_BY_AREA: Rule = {
  shape: "perAction",
  stat: "goals_scored",
  values: { byArea: { goalkeeper: 10, defence: 6, defensiveMidfield: 5, midfield: 5, attackingMidfield: 5, attack: 4 } },
};
const MINUTES: Rule = { shape: "bands", stat: "minutes", stack: false, values: { all: [{ atLeast: 1, points: 1 }, { atLeast: 60, points: 2 }] } };
const TACKLES_PLUS: NonNullable<StoredScoringSet["ownStats"]>[number] = {
  stat: "own_tackles_plus",
  name: "Tackles plus",
  shortCode: "TP",
  parts: [
    { stat: "tackles", weight: 1 },
    { stat: "clearances_blocks_interceptions", weight: 0.5 },
  ],
};

describe("a rule's values", () => {
  test("the same for all says before and after", () => {
    expect(scoringChanges(set([assists(3)]), set([assists(4)]))).toEqual(["Assists: 3 → 4"]);
  });

  test("by area names each group of positions that moved alike, and only those", () => {
    const after: Rule = { ...GOALS_BY_AREA, values: { all: 5 } };

    expect(scoringChanges(set([GOALS_BY_AREA]), set([after]))).toEqual(["Goals scored: GK: 10 → 5; FB, CB: 6 → 5; ST: 4 → 5"]);
  });

  test("a negative value and a value per number of actions", () => {
    const before: Rule = { shape: "perCount", stat: "saves", values: { all: { every: 3, points: 1 } } };
    const after: Rule = { shape: "perCount", stat: "saves", values: { all: { every: 2, points: -1 } } };

    expect(scoringChanges(set([before]), set([after]))).toEqual(["Saves: 1 per 3 → −1 per 2"]);
  });

  test("bands, and whether they stack", () => {
    const after: Rule = { ...MINUTES, stack: true, values: { all: [{ atLeast: 60, points: 3 }] } };

    expect(scoringChanges(set([MINUTES]), set([after]))).toEqual([
      "Minutes: 1 at 1+, 2 at 60+ → 3 at 60+",
      "Minutes: every band reached now counts",
    ]);
  });

  test("a new shape describes the rule afresh", () => {
    const after: Rule = { shape: "bands", stat: "assists", stack: false, values: { all: [] } };

    expect(scoringChanges(set([assists(3)]), set([after]))).toEqual(["Assists: now worth nothing in bands"]);
  });
});

describe("a rule's options", () => {
  test("a points limit and minimum minutes, added, changed and taken off", () => {
    const limited: Rule = { ...assists(3), limit: { all: { max: 2, min: null } }, minMinutes: { all: 60 } };
    const loosened: Rule = { ...assists(3), limit: { all: { max: 4, min: -1 } } };

    expect(scoringChanges(set([assists(3)]), set([limited]))).toEqual([
      "Assists, points limit: none → at most 2",
      "Assists, earned only after: none → 60 minutes",
    ]);
    expect(scoringChanges(set([limited]), set([loosened]))).toEqual([
      "Assists, points limit: at most 2 → at most 4, at least −1",
      "Assists, earned only after: 60 minutes → none",
    ]);
  });
});

describe("the set", () => {
  test("a category newly scored, by area, and one no longer scored", () => {
    expect(scoringChanges(set([assists(3)]), set([GOALS_BY_AREA]))).toEqual([
      "Goals scored: newly scored, GK: 10; FB, CB: 6; WB, CDM, WM, CM, W, CAM: 5; ST: 4 per action",
      "Assists: no longer scored",
    ]);
  });

  test("whole points only, each way", () => {
    expect(scoringChanges(set([]), set([], { wholePointsOnly: true }))).toEqual(["Points are now whole only"]);
    expect(scoringChanges(set([], { wholePointsOnly: true }), set([]))).toEqual(["Points can now be fractions"]);
  });

  test("own stats added, changed and removed", () => {
    const changed = { ...TACKLES_PLUS, parts: [{ stat: "tackles", weight: 1 }, { stat: "shot_off_target", weight: -1 }] };

    expect(scoringChanges(set([]), set([], { ownStats: [TACKLES_PLUS] }))).toEqual([
      "New own stat: Tackles plus (TP) = Tackles + 0.5 × Clearances blocks interceptions",
    ]);
    expect(scoringChanges(set([], { ownStats: [TACKLES_PLUS] }), set([], { ownStats: [changed] }))).toEqual([
      "Own stat Tackles plus (TP) is now Tackles plus (TP) = Tackles − Shot off target",
    ]);
    expect(scoringChanges(set([], { ownStats: [TACKLES_PLUS] }), set([]))).toEqual(["Own stat removed: Tackles plus (TP)"]);
  });

  test("a rule scoring an own stat is named by it", () => {
    const rule: Rule = { shape: "perAction", stat: TACKLES_PLUS.stat, values: { all: 1 } };

    expect(scoringChanges(set([], { ownStats: [TACKLES_PLUS] }), set([rule], { ownStats: [TACKLES_PLUS] }))).toEqual([
      "Tackles plus: newly scored, 1 per action",
    ]);
  });

  test("the same set, or only its categories reordered, changes nothing", () => {
    expect(scoringChanges(set([assists(3), MINUTES]), set([MINUTES, assists(3)]))).toEqual([]);
  });

  test("a second rule for one category is compared with the second before it", () => {
    expect(scoringChanges(set([assists(3), assists(1)]), set([assists(3), assists(2)]))).toEqual(["Assists: 1 → 2"]);
  });
});
