import { describe, expect, test } from "vitest";
import { balanceLab, roleStats, slotOfStart, type PastStart } from "../../../convex/balanceLab/balanceLab";
import type { ScoringSet } from "../../../convex/scoring/scoringSet";
import { EXAMPLE_SET, shotStopper } from "../../support/convex/scoring.example";

// The rule balance lab (spec/14; #843): each role's average a start over its slot's real past
// starts against the slot's target, "not tested" where the past seasons lack a stat it scores.

type RoleScoring = NonNullable<ScoringSet["roles"]>[number];
const side = (bars: number[], ...parts: [string, number][]) => ({ bars, parts: parts.map(([stat, weight]) => ({ stat, weight })) });
/** A number 10 on through balls and open-play key passes, neither copied. */
const numberTen: RoleScoring = { role: "numberTen", bonus: side([2, 4, 6], ["accurate_through_ball", 1], ["att_assist_openplay", 1]), cost: side([1, 2, 3], ["goals_scored", 1]) };
const setWith = (...roles: RoleScoring[]): ScoringSet => ({ ...EXAMPLE_SET, roles });

const start = (startingPosition: string, stats: Record<string, number>, season = 2024): PastStart => ({ season, kickoff: 1, startingPosition, stats });
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
    expect(report.roles).toEqual([{ role: "numberTen", slot: "CAM", target: 0.6, missing: ["accurate_through_ball", "att_assist_openplay"] }]);
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

describe("team instructions on the past seasons (#1541)", () => {
  type InstructionScoring = NonNullable<ScoringSet["instructions"]>[number];
  const line = (...stats: string[]) => ({ stats: stats.map((stat) => ({ stat, weight: 1 })), every: 1, points: 1 });
  const gungHo: InstructionScoring = { instruction: "gungHo", lines: [line("goals_scored", "assists"), line("goals_conceded")] };
  const shootOnSight: InstructionScoring = { instruction: "shootOnSight", lines: [line("att_obox_goal"), line("att_obox_miss", "ontarget_scoring_att")] };

  const getStuckIn: InstructionScoring = { instruction: "getStuckIn", lines: [line("goals_scored")] };
  const parkTheBus: InstructionScoring = { instruction: "parkTheBus", lines: [line("goals_scored")] };
  const FOUR_FOUR_TWO = ["GK", "DL", "DC", "DC", "DR", "ML", "MC", "MC", "MR", "ST", "ST"];
  const FIVE_FOUR_ONE = ["GK", "DL", "DCL", "DC", "DCR", "DR", "ML", "MC", "MC", "MR", "ST"];
  /** A club's XI at one kickoff, each starter on no goals but the last, on `goals`. */
  const xiOf = (club: string, positions: readonly string[], goals: number, kickoff = 1): PastStart[] =>
    positions.map((startingPosition, index) => ({ season: 2024, kickoff, club, startingPosition, stats: { goals_scored: index === positions.length - 1 ? goals : 0 } }));

  test("each instruction's average is for a whole XI, over each club's real XIs in a shape that allows it, in the set's order (S14.9, S14.19)", () => {
    // Leeds' 4-4-2 scores 2; Everton's 5-4-1 scores 1, and is the only one Park the bus's five at
    // the back allows; neither has Gung-ho's two at the back.
    const report = balanceLab({ ...EXAMPLE_SET, instructions: [getStuckIn, parkTheBus, gungHo, shootOnSight] }, [
      ...xiOf("Leeds", FOUR_FOUR_TWO, 2),
      ...xiOf("Everton", FIVE_FOUR_ONE, 1),
    ]);
    expect(report.instructions).toEqual([
      { instruction: "getStuckIn", xis: 2, average: 1.5 },
      { instruction: "parkTheBus", xis: 1, average: 1 },
      { instruction: "gungHo", xis: 0, average: null },
      { instruction: "shootOnSight", missing: ["att_obox_goal", "att_obox_miss"] },
    ]);
    expect(report).toMatchObject({ xis: 2, xisShort: 0 });
  });

  test("a stat blank for one starter counts as 0, and the XI stays in (S14.21)", () => {
    const [blank, ...rest] = xiOf("Leeds", FOUR_FOUR_TWO, 3);
    const report = balanceLab({ ...EXAMPLE_SET, instructions: [getStuckIn] }, [{ ...blank, stats: {} }, ...rest]);
    expect(report.instructions).toEqual([{ instruction: "getStuckIn", xis: 1, average: 3 }]);
  });

  test("the same club at another kickoff is another XI, and a start copied with no club is in none", () => {
    const { club: _club, ...clubless } = xiOf("Leeds", ["ST"], 5, 3)[0];
    const report = balanceLab({ ...EXAMPLE_SET, instructions: [getStuckIn] }, [...xiOf("Leeds", FOUR_FOUR_TWO, 2), ...xiOf("Leeds", FOUR_FOUR_TWO, 0, 2), clubless]);
    expect(report.instructions).toEqual([{ instruction: "getStuckIn", xis: 2, average: 1 }]);
  });

  test("an XI short of a starter whose position maps to a slot is scored on the ones it has, its shape read from them, and counted", () => {
    // A sweeper maps to no slot, so Everton stand four at the back: Park the bus doesn't allow it.
    const everton = xiOf("Everton", ["GK", "SW", "DL", "DC", "DR", "ML", "MC", "MC", "MR", "ST", "ST"], 1);
    const report = balanceLab({ ...EXAMPLE_SET, instructions: [getStuckIn, parkTheBus] }, everton);
    expect(report.instructions).toEqual([
      { instruction: "getStuckIn", xis: 1, average: 1 },
      { instruction: "parkTheBus", xis: 0, average: null },
    ]);
    expect(report).toMatchObject({ xis: 1, xisShort: 1 });
  });

  test("a line held to slots scores only the starters in them, on their slot from where they lined up", () => {
    const strikers: InstructionScoring = { instruction: "getStuckIn", lines: [{ ...line("goals_scored"), positions: ["ST"] }] };
    const leeds = xiOf("Leeds", FOUR_FOUR_TWO, 2).map((start) => ({ ...start, stats: { goals_scored: 1 } }));
    expect(balanceLab({ ...EXAMPLE_SET, instructions: [strikers] }, leeds).instructions).toEqual([{ instruction: "getStuckIn", xis: 1, average: 2 }]);
  });

  test("an own stat in a line counts as the stats it adds up", () => {
    const set: ScoringSet = {
      ...EXAMPLE_SET,
      ownStats: [{ stat: "league:failed_crosses", name: "Failed crosses", shortCode: "FCR", parts: [{ stat: "total_cross", weight: 1 }, { stat: "accurate_cross", weight: -1 }] }],
      instructions: [{ instruction: "getItWide", lines: [line("league:failed_crosses")] }],
    };
    expect(balanceLab(set, []).instructions).toEqual([{ instruction: "getItWide", xis: 0, average: null }]);
    // Five crosses, two found: three failed, worked out before the line scores them.
    const leeds = xiOf("Leeds", FOUR_FOUR_TWO, 0).map((each, index) => (index === 5 ? { ...each, stats: { total_cross: 5, accurate_cross: 2 } } : each));
    expect(balanceLab(set, leeds).instructions).toEqual([{ instruction: "getItWide", xis: 1, average: 3 }]);
  });

  test("a set scoring no instruction lists none", () => {
    expect(balanceLab(EXAMPLE_SET, KEEPERS).instructions).toEqual([]);
  });
});

test("the log's starting positions map to slots, left and right alike", () => {
  expect(["GK", "DR", "DL", "DC", "WBL", "DM", "MR", "MC", "AML", "AMC", "ST"].map(slotOfStart)).toEqual(["GK", "FB", "FB", "CB", "WB", "CDM", "WM", "CM", "W", "CAM", "ST"]);
  expect(["DCL", "DMR", "MCR", "AMCL", "STL", "FC"].map(slotOfStart)).toEqual(["CB", "WB", "CM", "CAM", "ST", "ST"]);
  expect(slotOfStart("SW")).toBeNull();
});
