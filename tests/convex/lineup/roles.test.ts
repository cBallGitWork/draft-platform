import { describe, expect, test } from "vitest";
import { lineupProblems, type Lineup } from "../../../convex/lineup/lineup";
import { problemWords } from "../../../convex/lineup/lineupWords";
import { AREAS, LANES, positionOfSlot, type SlotPosition } from "../../../convex/lineup/pitch";
import { centreBacksIn, DEFAULT_ROLES, everyRoleOf, isRole, offersRole, roleIn, roleName, rolesOfSlot } from "../../../convex/lineup/roles";
import { FIRST_ROLE_OWN_STATS, FIRST_ROLES } from "../../../convex/scoring/draftedRoleAdjustments";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { scoreTeam } from "../../../convex/scoring/teamPoints";
import { FIRST, STRIKER, STRIKERS_CELL, plays, subbed, withBench } from "../../support/convex/autoSubs.harness";
import { filledLineup, openLimits, presetNamed, REMOVED_ROLE } from "../../support/convex/lineup.harness";

// Roles (#10, #989, spec/05 Roles; Craig, 26 Oct and 4-5 Nov 2026): a slot offers the default set's
// list for the position it stands for, sweeper and libero only to centre-backs of a back three or
// more, a starter plays the one he was given or the slot's first, and a sub into the empty slot
// takes its role too.

const BACK_FOUR = presetNamed("4-4-2").cells;
const BACK_THREE = presetNamed("3-5-2").cells;
const BACK_TWO = presetNamed("2-3-5").cells;
const names = (roles: readonly { name: string }[]) => roles.map(({ name }) => name);

// Redrawn on #1196, 9 and 10 Nov 2026 (`S05.35`): the describe keeps its name so its tests are kept.
describe("the default set (spec/05 Roles, as merged 5 Nov 2026)", () => {
  // spec/05's list, position by position, in its order (docs/roles-first-values.md).
  const SPEC_LIST: Record<SlotPosition, readonly string[]> = {
    GK: ["Shot-stopper", "Sweeper keeper", "Distributor", "Commanding keeper"],
    FB: ["Overlapping full-back", "Inverted full-back", "Playmaking full-back", "Defensive full-back"],
    WB: ["Attacking wing-back", "Holding wing-back", "Complete wing-back", "Inverted wing-back", "Goalscoring wing-back"],
    CB: ["Stopper", "Ball-playing centre-back", "No-nonsense centre-back", "Attacking centre-back", "Sweeper", "Libero"],
    CDM: ["Metronome", "Quarterback", "Third centre-back", "Engine", "Tower", "Destroyer"],
    CM: ["Box-to-box", "Ball-winner", "Attacking 8", "Engine"],
    WM: ["Wide workhorse", "Defensive winger", "Wide playmaker", "Crosser"],
    CAM: ["Number 10", "Shadow striker", "Carrier", "Pressing 10"],
    W: ["Touchline winger", "Dribbler", "Inside forward", "Wide playmaker", "Pressing winger", "Tracking winger"],
    ST: ["Poacher", "Target man", "In-behind striker", "Pressing forward", "False 9"],
  };

  // S05.30
  test("the sweeper keeper and the libero are marked not tested, and no other role", () => {
    expect(everyRole.filter(({ notTested }) => notTested).map(({ key }) => key)).toEqual(["sweeperKeeper", "libero"]);
  });

  // S05.31
  test("there is no set-piece role", () => {
    expect(everyRole.some(({ name, rewards }) => /set.piece|corner|free kick/i.test([name, ...rewards].join(" ")))).toBe(false);
  });

  test("each position holds spec/05's roles in its order, the four keeper roles among them", () => {
    expect(Object.fromEntries(Object.entries(DEFAULT_ROLES).map(([position, roles]) => [position, names(roles)]))).toEqual(SPEC_LIST);
  });

  test("there is no free role (Craig, 5 Nov 2026: \"we ditched free role\")", () => {
    expect(Object.values(DEFAULT_ROLES).flat().some(({ name }) => /free role/i.test(name))).toBe(false);
  });

  test("the cut roles are gone, and a saved lineup holding one plays the slot's first", () => {
    for (const cut of ["attackingFullBack", "anchor", "deepPlaymaker", "playmaker"]) expect(isRole(cut), cut).toBe(false);
    const leftBack = { area: "defence", lane: "left" } as const;
    expect(roleIn(leftBack, "attackingFullBack").name).toBe("Overlapping full-back");
  });

  const everyRole = Object.values(DEFAULT_ROLES).flat();

  test("every role holds a code of at most three, its own, shown on the pitch", () => {
    for (const { key, code } of everyRole) expect(code, key).toMatch(/^[A-Z0-9]{1,3}$/);
    expect(new Set(everyRole.map(({ code }) => code)).size).toBe(new Set(everyRole.map(({ key }) => key)).size);
  });

  test("every role holds a description and what it rewards and costs, as categories without values", () => {
    for (const { key, description, rewards, costs } of everyRole) {
      expect(description.length, key).toBeGreaterThan(0);
      expect(rewards.length, key).toBeGreaterThan(0);
      expect(costs.length, key).toBeGreaterThan(0);
      for (const category of [...rewards, ...costs]) expect(category, key).not.toMatch(/\d/);
    }
  });

  test("each key means one role wherever it is offered, and two roles of one name are told apart by position", () => {
    const byKey = new Map<string, string>();
    for (const { key, name } of everyRole) {
      expect(byKey.get(key) ?? name).toBe(name);
      byKey.set(key, name);
    }
    expect(roleName("engine")).toBe("Engine (defensive midfield)");
    expect(roleName("midfieldEngine")).toBe("Engine (centre midfield)");
    expect(roleName("poacher")).toBe("Poacher");
  });
});

describe("what a slot offers", () => {
  test("the position the slot stands for: a full-back's roles out wide in defence, a wing-back's in defensive midfield's", () => {
    expect(names(rolesOfSlot({ area: "defence", lane: "left" }, BACK_FOUR))).toEqual(names(DEFAULT_ROLES.FB));
    expect(names(rolesOfSlot({ area: "defensiveMidfield", lane: "right" }, BACK_FOUR))).toEqual(names(DEFAULT_ROLES.WB));
    // Wide midfield offers no wing-back role (Craig, 26 Oct 2026).
    expect(names(rolesOfSlot({ area: "midfield", lane: "left" }, BACK_FOUR))).toEqual(names(DEFAULT_ROLES.WM));
    expect(rolesOfSlot({ area: "attack", lane: "right" }, BACK_FOUR)).toHaveLength(5);
  });

  test("every cell of the pitch offers at least one, and with a back three, every role its position holds", () => {
    for (const area of AREAS) {
      for (const lane of LANES) {
        const cell = { area, lane };
        expect(rolesOfSlot(cell, BACK_FOUR).length).toBeGreaterThan(0);
        expect(rolesOfSlot(cell, BACK_THREE)).toEqual(DEFAULT_ROLES[positionOfSlot(cell)]);
        expect(everyRoleOf(cell)).toEqual(DEFAULT_ROLES[positionOfSlot(cell)]);
      }
    }
  });

  test("a starter plays the role he was given, or the slot's first until he is given one", () => {
    const cell = { area: "defence", lane: "left" } as const;
    expect(roleIn(cell, "invertedFullBack").name).toBe("Inverted full-back");
    expect(roleIn(cell, undefined).name).toBe("Overlapping full-back");
  });
});

describe("sweeper and libero (spec/05 The pitch; Craig, 4 Nov 2026)", () => {
  const centreBackCells = (formation: typeof BACK_FOUR) => formation.filter((cell) => positionOfSlot(cell) === "CB");

  test("with three or more centre-backs, every one of them is offered both", () => {
    expect(centreBacksIn(BACK_THREE)).toBe(3);
    for (const cell of centreBackCells(BACK_THREE)) {
      expect(offersRole(cell, "sweeper", BACK_THREE), cell.lane).toBe(true);
      expect(offersRole(cell, "libero", BACK_THREE), cell.lane).toBe(true);
    }
  });

  test("with two centre-backs, neither is offered, in a back four or a back two", () => {
    for (const formation of [BACK_FOUR, BACK_TWO]) {
      expect(centreBacksIn(formation)).toBe(2);
      for (const cell of centreBackCells(formation)) {
        expect(names(rolesOfSlot(cell, formation))).toEqual(["Stopper", "Ball-playing centre-back", "No-nonsense centre-back", "Attacking centre-back"]);
      }
    }
  });

  test("a full-back is never offered them, whatever the back line", () => {
    expect(offersRole({ area: "defence", lane: "left" }, "sweeper", presetNamed("5-3-2").cells)).toBe(false);
  });

  test("a back three keeps a centre-back on the stopper first", () => {
    const { lineup } = filledLineup(presetNamed("3-5-2"));
    const middle = lineup.starters.find((starter) => starter.area === "defence" && starter.lane === "centre")!;
    expect(roleIn({ area: "defence", lane: "centre" }, middle.role).key).toBe("stopper");
  });

  test("a back three may play as many as the manager likes; a back four's sweeper is refused, said in words", () => {
    const centreLanes: readonly string[] = ["leftCentre", "centre", "rightCentre"];
    const onRoles = (preset: string, role: string): ReturnType<typeof filledLineup> => {
      const filled = filledLineup(presetNamed(preset));
      const starters = filled.lineup.starters.map((starter) => (starter.area === "defence" && centreLanes.includes(starter.lane) ? { ...starter, role } : starter));
      return { ...filled, lineup: { ...filled.lineup, starters } };
    };
    for (const role of ["sweeper", "libero"]) {
      const three = onRoles("3-5-2", role);
      expect(lineupProblems(three.lineup, three.positions, openLimits())).toEqual([]);
    }
    const four = onRoles("4-4-2", "libero");
    const problems = lineupProblems(four.lineup, four.positions, openLimits());
    const [first, second] = four.lineup.starters.filter((starter) => starter.role === "libero");
    expect(problems).toEqual([
      { kind: "noBackThree", playerCode: first.playerCode, role: "libero", centreBacks: 2 },
      { kind: "noBackThree", playerCode: second.playerCode, role: "libero", centreBacks: 2 },
    ]);
    expect(problemWords(problems[0], (code) => `Player ${code}`)).toBe(`Player ${first.playerCode} can play Libero only with 3 or more centre-backs; this line-up has 2.`);
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
    expect(lineupProblems(withRole("invertedFullBack"), positions, openLimits())).toEqual([]);
  });

  test("one it doesn't is a problem, said in words", () => {
    const problems = lineupProblems(withRole("poacher"), positions, openLimits());
    expect(problems).toEqual([{ kind: "roleNotOffered", playerCode: leftBack.playerCode, area: "defence", lane: "left", role: "poacher" }]);
    expect(problemWords(problems[0], (code) => `Player ${code}`)).toContain("doesn't offer the role");
  });
});

describe("a role removed from the set (spec/05 Roles; #841; Craig, 31 Oct 2026)", () => {
  const { lineup, positions } = filledLineup(presetNamed("4-4-2"));
  const leftBack = lineup.starters[1];
  const cell = { area: "defence", lane: "left" } as const;
  const onRole = (role: string): Lineup => ({
    ...lineup,
    starters: lineup.starters.map((starter, index) => (index === 1 ? { ...starter, role } : starter)),
  });

  test("is no slot's, so the lineup holding it stands, never refused", () => {
    expect(leftBack).toMatchObject(cell);
    expect(isRole(REMOVED_ROLE)).toBe(false);
    expect(lineupProblems(onRole(REMOVED_ROLE), positions, openLimits())).toEqual([]);
  });

  test("is played as the slot's first, on the pitch as in scoring", () => {
    const first = everyRoleOf(cell)[0];
    expect(roleIn(cell, REMOVED_ROLE)).toBe(first);
    const scored = (role: string) =>
      scoreTeam({
        lineup: { starters: [{ ...leftBack, role }], bench: [] },
        matches: new Map([[leftBack.playerCode, [{ record: { minutes: 90, accurate_cross: 2, clean_sheets: 1 }, final: true }]]]),
        set: { ...FIRST_SCORING, ownStats: [...FIRST_ROLE_OWN_STATS], roles: [...FIRST_ROLES] },
        doubleGameweekRule: "bothMatches",
        substitutions: [],
        benchCells: new Map(),
      });
    expect(scored(REMOVED_ROLE)).toEqual(scored(first.key));
    expect(scored(REMOVED_ROLE).starters[0].role).toBe(first.key);
  });

  // Every key offered, by the position that offers it: a saved lineup may hold any of them, so a key
  // goes only on Craig's say (#989 cut four with no real lineups yet: "we are still building"). A
  // new role's key is added here.
  const OFFERED_ROLE_KEYS: Record<SlotPosition, readonly string[]> = {
    GK: ["shotStopper", "sweeperKeeper", "distributor", "commandingKeeper"],
    FB: ["overlappingFullBack", "invertedFullBack", "playmakingFullBack", "defensiveFullBack"],
    CB: ["stopper", "ballPlayingDefender", "noNonsenseCentreBack", "attackingCentreBack", "sweeper", "libero"],
    WB: ["attackingWingBack", "holdingWingBack", "completeWingBack", "invertedWingBack", "goalscoringWingBack"],
    // The half-back is the third centre-back, under the key saved lineups hold (#1196).
    CDM: ["metronome", "quarterback", "halfBack", "engine", "tower", "destroyer"],
    WM: ["wideMidfielder", "defensiveWinger", "wideMidfieldPlaymaker", "crosser"],
    CM: ["boxToBox", "ballWinner", "attackingEight", "midfieldEngine"],
    W: ["winger", "dribbler", "insideForward", "widePlaymaker", "pressingWinger", "trackingWinger"],
    CAM: ["numberTen", "attackingMidfieldShadowStriker", "carrier", "pressingTen"],
    ST: ["poacher", "targetMan", "inBehindStriker", "pressingForward", "falseNine"],
  };

  test("the roles cut on #1196 are no slot's now", () => {
    for (const cut of ["underlappingFullBack", "wideMidfieldWinger", "lateRunner", "wideForward", "maverick", "shadowStriker"]) expect(isRole(cut), cut).toBe(false);
  });

  test("every key offered is pinned here, so none goes unnoticed", () => {
    const offered = Object.fromEntries(Object.entries(DEFAULT_ROLES).map(([position, roles]) => [position, roles.map(({ key }) => key)]));
    expect(offered).toEqual(OFFERED_ROLE_KEYS);
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
