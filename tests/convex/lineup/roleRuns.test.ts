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
      "maverick",
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
});
