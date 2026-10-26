import { describe, expect, test } from "vitest";
import { lineupProblems, type Lineup } from "../../../convex/lineup/lineup";
import { problemWords } from "../../../convex/lineup/lineupWords";
import { AREAS, LANES, positionOfSlot } from "../../../convex/lineup/pitch";
import { DEFAULT_ROLES, roleIn, rolesOfSlot } from "../../../convex/lineup/roles";
import { FIRST, STRIKER, STRIKERS_CELL, plays, subbed, withBench } from "../../support/convex/autoSubs.harness";
import { filledLineup, openLimits, presetNamed } from "../../support/convex/lineup.harness";

// Roles (#10, spec/05 Roles; Craig, 26 Oct 2026): a slot offers the default set's list for the
// position it stands for, a starter plays the one he was given or the slot's first, and a sub
// into the empty slot takes its role too.

describe("what a slot offers", () => {
  test("the position the slot stands for: a full-back's roles out wide in defence, a wing-back's in defensive midfield's", () => {
    expect(rolesOfSlot({ area: "defence", lane: "left" }).map(({ name }) => name)).toEqual(["Defensive full-back", "Attacking full-back"]);
    expect(rolesOfSlot({ area: "defence", lane: "centre" }).map(({ name }) => name)).toEqual(["Stopper", "Ball-playing defender"]);
    expect(rolesOfSlot({ area: "defensiveMidfield", lane: "right" }).map(({ name }) => name)).toEqual(["Attacking wing-back", "Holding wing-back"]);
    // Wide midfield offers no wing-back role (Craig, 26 Oct 2026).
    expect(rolesOfSlot({ area: "midfield", lane: "left" }).map(({ name }) => name)).toEqual(["Winger", "Defensive winger"]);
    expect(rolesOfSlot({ area: "attack", lane: "right" })).toHaveLength(5);
  });

  test("every cell of the pitch offers at least one, and each key means one role wherever it is offered", () => {
    const byKey = new Map<string, string>();
    for (const area of AREAS) {
      for (const lane of LANES) {
        const roles = rolesOfSlot({ area, lane });
        expect(roles.length).toBeGreaterThan(0);
        expect(roles).toBe(DEFAULT_ROLES[positionOfSlot({ area, lane })]);
        for (const { key, name } of roles) {
          expect(byKey.get(key) ?? name).toBe(name);
          byKey.set(key, name);
        }
      }
    }
  });

  test("a starter plays the role he was given, or the slot's first until he is given one", () => {
    const cell = { area: "defence", lane: "left" } as const;
    expect(roleIn(cell, "attackingFullBack").name).toBe("Attacking full-back");
    expect(roleIn(cell, undefined).name).toBe("Defensive full-back");
  });
});

describe("a lineup refused for a role its slot doesn't offer", () => {
  const { lineup, positions } = filledLineup(presetNamed("4-4-2"));
  const withRole = (role: string): Lineup => ({
    ...lineup,
    starters: lineup.starters.map((starter, index) => (index === 1 ? { ...starter, role } : starter)),
  });
  const leftBack = lineup.starters[1];

  test("one his slot offers stands", () => {
    expect(leftBack).toMatchObject({ area: "defence", lane: "left" });
    expect(lineupProblems(withRole("attackingFullBack"), positions, openLimits())).toEqual([]);
  });

  test("one it doesn't is a problem, said in words", () => {
    const problems = lineupProblems(withRole("poacher"), positions, openLimits());
    expect(problems).toEqual([{ kind: "roleNotOffered", playerCode: leftBack.playerCode, area: "defence", lane: "left", role: "poacher" }]);
    expect(problemWords(problems[0], (code) => `Player ${code}`)).toContain("doesn't offer the role");
  });
});

describe("an auto-sub (spec/05 Auto-subs)", () => {
  test("into the empty slot takes its role too", () => {
    const { lineup, positions } = withBench(["ST"]);
    const pressing: Lineup = { ...lineup, starters: lineup.starters.map((starter) => (starter.playerCode === STRIKER ? { ...starter, role: "pressingForward" } : starter)) };
    const result = subbed(pressing, positions, plays(pressing, [STRIKER]));
    expect(result.lineup.starters).toContainEqual({ playerCode: FIRST, ...STRIKERS_CELL, role: "pressingForward" });
  });
});
