import { describe, expect, test } from "vitest";
import { balanceLab, roleStats, slotOfStart, type PastStart } from "../../../convex/balanceLab/balanceLab";
import type { ScoringSet } from "../../../convex/scoring/scoringSet";
import { EXAMPLE_SET } from "../../support/convex/scoring.example";

// The rule balance lab (spec/14; #843): each role's average a start over its slot's real past
// starts against the slot's target, "not tested" where the past seasons lack a stat it scores.

type RoleScoring = NonNullable<ScoringSet["roles"]>[number];
const side = (bars: number[], ...parts: [string, number][]) => ({ bars, parts: parts.map(([stat, weight]) => ({ stat, weight })) });
/** A shot-stopper on saves alone (copied), costing for goals conceded (copied). */
const shotStopper = (bars: number[]): RoleScoring => ({ role: "shotStopper", bonus: side(bars, ["saves", 1]), cost: side([3, 4, 5], ["goals_conceded", 1]) });
/** A number 10 on key passes and big chances created, neither copied. */
const numberTen: RoleScoring = { role: "numberTen", bonus: side([2, 4, 6], ["big_chance_created", 1], ["att_assist_openplay", 1]), cost: side([1, 2, 3], ["goals_scored", 1]) };
const setWith = (...roles: RoleScoring[]): ScoringSet => ({ ...EXAMPLE_SET, roles });

const start = (startingPosition: string, stats: Record<string, number>, season = 2024): PastStart => ({ season, startingPosition, stats });
const KEEPERS = [start("GK", { saves: 2, goals_conceded: 0 }), start("GK", { saves: 4, goals_conceded: 3 }, 2025), start("GK", { saves: 6, goals_conceded: 1 })];

describe("roles on the past seasons", () => {
  test("each start counts in its slot, and a role's average is its points a start against the slot's target", () => {
    // Bars at 2, 4, 6: +1, +2 −1, +3 → 5 over 3 starts.
    const report = balanceLab(setWith(shotStopper([2, 4, 6])), [...KEEPERS, start("ST", { saves: 9, goals_conceded: 0 })]);
    expect(report.roles).toEqual([{ role: "shotStopper", slot: "GK", target: 0.9, starts: 3, average: 1.67, offTarget: true }]);
    expect(report).toMatchObject({ seasons: [2024, 2025], starts: 4, startsSkipped: 0 });
  });

  test("a draft that raises a role's bars moves its average onto the target", () => {
    // Bars at 4, 6, 8: 0, +1 −1, +2 → 2 over 3 starts.
    const [role] = balanceLab(setWith(shotStopper([4, 6, 8])), KEEPERS).roles;
    expect(role).toMatchObject({ average: 0.67, offTarget: false });
  });

  test("a role scoring a stat the past seasons weren't copied with is not tested, naming the stats", () => {
    const report = balanceLab(setWith(numberTen), [start("AMC", { goals_scored: 1 })]);
    expect(report.roles).toEqual([{ role: "numberTen", slot: "CAM", target: 0.6, missing: ["att_assist_openplay", "big_chance_created"] }]);
  });

  test("an own stat counts as the stats it adds up", () => {
    const set: ScoringSet = {
      ...setWith({ role: "shotStopper", bonus: side([1, 2, 3], ["league:stops", 1]), cost: side([1, 2, 3], ["red_cards", 1]) }),
      ownStats: [{ stat: "league:stops", name: "Stops", shortCode: "STP", parts: [{ stat: "saves", weight: 1 }, { stat: "penalties_saved", weight: 2 }] }],
    };
    expect(roleStats(set, "shotStopper")).toEqual(["penalties_saved", "red_cards", "saves"]);
    const [role] = balanceLab(set, [start("GK", { saves: 1, penalties_saved: 1, red_cards: 0 })]).roles;
    expect(role).toMatchObject({ starts: 1, average: 3 });
  });

  test("a start whose position maps to no slot is skipped and counted, and a blank stat leaves only that start out", () => {
    const report = balanceLab(setWith(shotStopper([2, 4, 6])), [start("GK", { saves: 2 }), start("SW", { saves: 2, goals_conceded: 0 }), KEEPERS[0]]);
    expect(report).toMatchObject({ starts: 2, startsSkipped: 1 });
    expect(report.roles[0]).toMatchObject({ starts: 1, average: 1 });
  });

  test("a role with no start to test has no average and no flag", () => {
    expect(balanceLab(setWith(shotStopper([2, 4, 6])), []).roles[0]).toMatchObject({ starts: 0, average: null, offTarget: false });
  });

  test("a role the set doesn't score isn't listed", () => {
    expect(balanceLab(EXAMPLE_SET, KEEPERS).roles).toEqual([]);
  });
});

test("the log's starting positions map to slots, left and right alike", () => {
  expect(["GK", "DR", "DL", "DC", "WBL", "DM", "MR", "MC", "AML", "AMC", "ST"].map(slotOfStart)).toEqual(["GK", "FB", "FB", "CB", "WB", "CDM", "WM", "CM", "W", "CAM", "ST"]);
  expect(slotOfStart("SW")).toBeNull();
});
