import { describe, expect, test } from "vitest";
import { lineupProblems, type Lineup } from "../../../convex/lineup/lineup";
import { problemWords } from "../../../convex/lineup/lineupWords";
import { AREAS, LANES, positionOfSlot } from "../../../convex/lineup/pitch";
import { DEFAULT_ROLES, roleIn, roleName, rolesOfSlot, slotLabel, SWEEPER, SWEEPER_CELL } from "../../../convex/lineup/roles";
import { FIRST, STRIKER, STRIKERS_CELL, plays, subbed, withBench } from "../../support/convex/autoSubs.harness";
import { filledLineup, openLimits, presetNamed } from "../../support/convex/lineup.harness";

// Roles (#10, spec/05 Roles; Craig, 26 Oct 2026): a slot offers the default set's list for the
// position it stands for, a starter plays the one he was given or the slot's first, and a sub
// into the empty slot takes its role too.

describe("what a slot offers", () => {
  test("the position the slot stands for: a full-back's roles out wide in defence, a wing-back's in defensive midfield's", () => {
    expect(rolesOfSlot({ area: "defence", lane: "left" }).map(({ name }) => name)).toEqual(["Defensive full-back", "Attacking full-back"]);
    expect(rolesOfSlot({ area: "defence", lane: "leftCentre" }).map(({ name }) => name)).toEqual(["Stopper", "Ball-playing defender"]);
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
        expect(roles).toEqual(expect.arrayContaining([...DEFAULT_ROLES[positionOfSlot({ area, lane })]]));
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

describe("the sweeper (spec/05 The pitch; #844; Craig, 31 Oct 2026)", () => {
  const centre = SWEEPER_CELL;

  test("the defence's centre cell offers the centre-back's roles, then sweeper and libero", () => {
    expect(rolesOfSlot(centre).map(({ name }) => name)).toEqual(["Stopper", "Ball-playing defender", "Sweeper", "Libero"]);
    expect(rolesOfSlot({ area: "defence", lane: "rightCentre" }).map(({ key }) => key)).not.toContain("sweeper");
  });

  test("its label is SW only on a sweeper's role, CB on a centre-back's or none given", () => {
    expect(slotLabel(centre, "sweeper")).toBe(SWEEPER);
    expect(slotLabel(centre, "libero")).toBe(SWEEPER);
    expect(slotLabel(centre, "stopper")).toBe("CB");
    expect(slotLabel(centre, "ballPlayingDefender")).toBe("CB");
    expect(slotLabel(centre, undefined)).toBe("CB");
    // A sweeper's key held where it isn't offered falls to the slot's first role.
    expect(slotLabel({ area: "defence", lane: "leftCentre" }, "sweeper")).toBe("CB");
  });

  test("the saved role keys stand: the centre-back's keep theirs and the sweeper's are new", () => {
    expect(DEFAULT_ROLES.CB.map(({ key }) => key)).toEqual(["stopper", "ballPlayingDefender"]);
    expect(DEFAULT_ROLES.SW.map(({ key }) => key)).toEqual(["sweeper", "libero"]);
    expect(roleName("sweeper")).toBe("Sweeper");
    expect(roleName("sweeperKeeper")).toBe("Sweeper keeper");
  });

  test("a back-three preset keeps a centre-back in the middle", () => {
    const { lineup } = filledLineup(presetNamed("3-5-2"));
    const middle = lineup.starters.find((starter) => starter.area === centre.area && starter.lane === centre.lane);
    expect(middle).toBeDefined();
    expect(roleIn(centre, middle!.role).key).toBe("stopper");
    expect(slotLabel(centre, middle!.role)).toBe("CB");
  });

  test("a lineup with a sweeper in the centre cell stands; out of it, it is refused", () => {
    const { lineup, positions } = filledLineup(presetNamed("3-5-2"));
    const onRole = (cell: { area: string; lane: string }, role: string): Lineup => ({
      ...lineup,
      starters: lineup.starters.map((starter) => (starter.area === cell.area && starter.lane === cell.lane ? { ...starter, role } : starter)),
    });
    expect(lineupProblems(onRole(centre, "libero"), positions, openLimits())).toEqual([]);
    const left = { area: "defence", lane: "leftCentre" } as const;
    expect(lineupProblems(onRole(left, "sweeper"), positions, openLimits())).toMatchObject([{ kind: "roleNotOffered", role: "sweeper" }]);
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

describe("each role's run (spec/05 Runs; #846; Craig, 31 Oct 2026)", () => {
  const everyRole = Object.values(DEFAULT_ROLES).flat();

  test("every default role holds its place or has a run, each marked rough until its own research", () => {
    for (const { key, run } of everyRole) {
      if (run === null) continue;
      expect(run.rough, key).toBe(true);
      expect(run.path.length, key).toBeGreaterThan(0);
    }
  });

  test("the roles that hold their place have none, and the moving ones go where FM's nearest would", () => {
    const holding = everyRole.filter(({ run }) => run === null).map(({ key }) => key);
    expect(holding).toEqual(["shotStopper", "defensiveFullBack", "ballPlayingDefender", "holdingWingBack", "anchor", "deepPlaymaker", "targetMan"]);
    const endOf = (key: string) => everyRole.find((each) => each.key === key)!.run!.path.at(-1)!;
    expect(endOf("attackingFullBack").forward).toBeGreaterThan(0);
    expect(endOf("falseNine").forward).toBeLessThan(0);
    expect(endOf("insideForward").across).toBeGreaterThan(0);
  });
});
