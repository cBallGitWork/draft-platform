import { describe, expect, test } from "vitest";
import type { PastStart } from "../../../convex/balanceLab/balanceLab";
import { backtestLines, refitBonusBars, roleAverages, roleBacktest } from "../../../convex/balanceLab/roleBacktest";
import type { Position } from "../../../convex/positions/positionTables";
import type { ScoringSet } from "../../../convex/scoring/scoringSet";
import { EXAMPLE_SET, shotStopper } from "../../support/convex/scoring.example";

// The redrawn roles' backtest (#1446; spec/05): who may take a role (S05.29) over every past start
// (S05.33), and a failing role refitted until it lands within 0.25 of its target (S05.10).

type RoleScoring = NonNullable<ScoringSet["roles"]>[number];
const side = (bars: number[], stat: string) => ({ bars, parts: [{ stat, weight: 1 }] });
/** A poacher on goals, costing nothing anyone makes here. */
const goalPoacher: RoleScoring = { role: "poacher", bonus: side([1, 2, 3], "goals_scored"), cost: side([1, 2, 3], "own_goals") };
const setWith = (...roles: RoleScoring[]): ScoringSet => ({ ...EXAMPLE_SET, roles });

const start = (player: PastStart["player"], startingPosition: string, stats: Record<string, number>): PastStart => ({ season: 2024, player, kickoff: 1, startingPosition, stats });
const WINGER = 10;
const CENTRE_FORWARD = 11;
const UNMATCHED = 12;
const matched = new Map<number, Position[]>([
  [WINGER, ["W"]],
  [CENTRE_FORWARD, ["ST"]],
]);
const goals = (goals_scored: number) => ({ goals_scored, own_goals: 0 });

describe("who may take a role, in the backtest", () => {
  test("S05.29 a matched winger's start up front doesn't count for poacher; a striker's and an unmatched man's do", () => {
    const starts = [start(WINGER, "ST", goals(3)), start(CENTRE_FORWARD, "ST", goals(1)), start(UNMATCHED, "ST", goals(0)), start("no-code", "ST", goals(0))];
    const { roles } = roleBacktest(setWith(goalPoacher), starts, matched);
    expect(roles).toEqual([{ role: "poacher", slot: "ST", target: 0.5, starts: 3, average: 0.33, offTarget: false }]);
  });

  test("S05.33 every past start counts in his slot, matched to Sportmonks or not", () => {
    const { roles } = roleBacktest(setWith(shotStopper([2, 4, 6])), [start(UNMATCHED, "GK", { saves: 2, goals_conceded: 0 })], matched);
    expect(roles[0]).toMatchObject({ starts: 1, average: 1 });
  });
});

describe("a role off its target", () => {
  // Saves 2, 4 and 6 with bars at 2, 4, 6: +1, +2 −1, +3 → 1.67 a start against the keeper's 0.9.
  const KEEPERS = [start(1, "GK", { saves: 2, goals_conceded: 0 }), start(2, "GK", { saves: 4, goals_conceded: 3 }), start(3, "GK", { saves: 6, goals_conceded: 1 })];

  test("S05.10 fails, and its bonus bars are refitted until it lands within 0.25, old against new", () => {
    const backtest = roleBacktest(setWith(shotStopper([2, 4, 6])), KEEPERS, matched);
    expect(backtest.roles[0]).toMatchObject({ average: 1.67, offTarget: true });
    const [refit] = backtest.refits;
    expect(refit).toMatchObject({ role: "shotStopper", slot: "GK", old: [2, 4, 6] });
    expect(Math.abs(refit!.average! - 0.9)).toBeLessThanOrEqual(0.25);
    expect(roleBacktest(setWith(shotStopper(refit!.bars!)), KEEPERS, matched).roles[0]).toMatchObject({ offTarget: false });
  });

  test("S05.10 where no bars land it within 0.25, the refit says so", () => {
    // A keeper with no saves who concedes three: the cost takes 1, and no bonus bars reach 0 saves.
    const leaky = [start(1, "GK", { saves: 0, goals_conceded: 3 })];
    const { refits } = roleBacktest(setWith(shotStopper([2, 4, 6])), leaky, matched);
    expect(refits).toEqual([{ role: "shotStopper", slot: "GK", old: [2, 4, 6], bars: null, average: -1 }]);
    expect(backtestLines({ roles: [], refits })).toEqual(["Refitted, old → new:", "GK shotStopper: bonus bars 2, 4, 6: no bars land it within 0.25 (closest average -1)"]);
  });

  test("S05.10 a refit keeps its bars rising", () => {
    const fit = refitBonusBars(setWith(shotStopper([2, 4, 6])), "shotStopper", KEEPERS, 0.9);
    expect(fit!.bars).toEqual([...fit!.bars].sort((a, b) => a - b));
    expect(new Set(fit!.bars).size).toBe(3);
  });
});

describe("the command's printout", () => {
  test("S05.10 S05.28 prints every role: starts, average, target, pass or fail, or not tested", () => {
    const numberTen: RoleScoring = { role: "numberTen", bonus: side([1, 2, 3], "accurate_through_ball"), cost: side([1, 2, 3], "own_goals") };
    const backtest = roleBacktest(setWith(shotStopper([2, 4, 6]), goalPoacher, numberTen), [start(CENTRE_FORWARD, "ST", goals(1))], matched);
    expect(backtestLines(backtest).slice(0, 3)).toEqual([
      "GK shotStopper: not tested, no past start",
      "CAM numberTen: not tested, the past seasons have no accurate_through_ball",
      "ST poacher: 1 starts, average 1, target 0.5, fail",
    ]);
    expect(roleAverages(backtest.roles)).toEqual([{ role: "poacher", slot: "ST", target: 0.5, starts: 1, average: 1 }]);
  });
});
