import { describe, expect, test } from "vitest";
import { DEFAULT_ROLES } from "../../../convex/lineup/roles";

// Each role's run (spec/05 Runs; #846, #962): where a player on the role goes as if it were a real
// match, held with the role, as docs/role-runs.md's research found it.

describe("each role's run (spec/05 Runs; #846, #962; Craig, 31 Oct 2026)", () => {
  const everyRole = Object.values(DEFAULT_ROLES).flat();
  const roleOf = (key: string) => everyRole.find((each) => each.key === key)!;
  const endOf = (key: string) => roleOf(key).run!.path.at(-1)!;

  test("every default role holds its place or has a run of at least one point", () => {
    for (const { key, run } of everyRole) {
      if (run === null) continue;
      expect(run.path.length, key).toBeGreaterThan(0);
    }
  });

  test("the roles that hold their place have none, and the moving ones go where their research puts them", () => {
    const holding = everyRole.filter(({ run }) => run === null).map(({ key }) => key);
    expect(holding).toEqual([
      "shotStopper",
      "distributor",
      "commandingKeeper",
      "playmakingFullBack",
      "defensiveFullBack",
      "ballPlayingDefender",
      "noNonsenseCentreBack",
      "holdingWingBack",
      "metronome",
      "quarterback",
      "tower",
      "destroyer",
      "targetMan",
    ]);
    expect(endOf("overlappingFullBack").forward).toBeGreaterThan(0);
    expect(endOf("halfBack").forward).toBeLessThan(0);
    expect(endOf("falseNine").forward).toBeLessThan(0);
    expect(endOf("insideForward").across).toBeGreaterThan(0);
  });

  test("an overlapping full-back goes round the outside to their third, an inverted one inside", () => {
    expect(endOf("overlappingFullBack")).toEqual({ forward: 60, across: -3 });
    expect(endOf("invertedFullBack").across).toBeGreaterThan(endOf("invertedFullBack").forward);
  });

  test("a sweeper ends behind his line, and the box-to-box and complete roles end back past where they started", () => {
    expect(endOf("sweeper").forward).toBeLessThan(0);
    for (const key of ["boxToBox", "engine", "midfieldEngine", "completeWingBack", "wideMidfielder"]) {
      const path = roleOf(key).run!.path;
      expect(path[0].forward, key).toBeGreaterThan(0);
      expect(path.at(-1)!.forward, key).toBeLessThan(0);
    }
  });

  test("a tracking winger tracks back into his own third, two rows and more", () => {
    expect(endOf("trackingWinger").forward).toBeLessThan(-35);
  });

  // Every moving role's run, point by point, from docs/role-runs.md's research. A run changed in
  // the code alone fails here, so whoever changes it also checks the doc's line for that role.
  test("every moving role's run is pinned point by point", () => {
    const runs = Object.fromEntries(
      everyRole.filter(({ run }) => run !== null).map(({ key, run }) => [key, run!.path.map(({ forward, across }) => [forward, across])]),
    );
    expect(runs).toEqual({
      sweeperKeeper: [[9, 0]],
      overlappingFullBack: [[22, -1], [60, -3]],
      invertedFullBack: [[12, 16]],
      stopper: [[9, 0]],
      attackingCentreBack: [[34, 0], [60, 3]],
      sweeper: [[-6, 4], [-5, 16]],
      libero: [[18, 0], [32, 3]],
      attackingWingBack: [[44, -2]],
      completeWingBack: [[44, -2], [-10, 2]],
      invertedWingBack: [[10, 16]],
      goalscoringWingBack: [[24, 0], [46, 18]],
      halfBack: [[-16, 6]],
      engine: [[14, 3], [-10, -3]],
      wideMidfielder: [[20, -1], [-20, 1]],
      defensiveWinger: [[-20, 1]],
      wideMidfieldPlaymaker: [[10, 16]],
      crosser: [[30, -2]],
      boxToBox: [[28, 3], [-10, -3]],
      ballWinner: [[8, -8], [10, 8]],
      attackingEight: [[18, 6], [30, 8]],
      midfieldEngine: [[16, 3], [-12, -3]],
      winger: [[18, -2], [21, 6]],
      dribbler: [[10, 4], [16, 12]],
      insideForward: [[8, 6], [14, 18]],
      widePlaymaker: [[-2, 14]],
      pressingWinger: [[8, 4], [12, 12]],
      trackingWinger: [[-44, -1]],
      numberTen: [[4, 10]],
      attackingMidfieldShadowStriker: [[10, 2], [18, 10]],
      carrier: [[9, 0]],
      pressingTen: [[6, -6], [12, 6]],
      poacher: [[5, 10]],
      inBehindStriker: [[3, -8], [6, 8]],
      pressingForward: [[5, -10], [5, 10]],
      falseNine: [[-16, 2]],
    });
  });
});
