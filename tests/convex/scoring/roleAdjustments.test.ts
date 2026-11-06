import { describe, expect, test } from "vitest";
import { FIRST_ROLE_OWN_STATS, FIRST_ROLES } from "../../../convex/scoring/draftedRoleAdjustments";
import { DEFAULT_ROLES } from "../../../convex/lineup/roles";
import { scoringChanges } from "../../../convex/scoring/patchChanges";
import { scoreMatch } from "../../../convex/scoring/scoring";
import { ROLE_BARS_MOST, validateScoringSet, type RoleScoring, type ScoringSet } from "../../../convex/scoring/scoringSet";
import type { StoredScoringSet } from "../../../convex/scoring/scoringSetShape";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { scoreTeam } from "../../../convex/scoring/teamPoints";

// A role's scoring (#10, spec/05 Roles): whole points by bars, +1 at each of up to three bars of its
// bonus mix and −1 at each of up to three of its cost, so ±3 at most, added to base points on top
// of every rule and its points limit (spec/14), whatever his minutes (Craig, 5 Nov 2026).

const STRIKER = { area: "attack", lane: "centre" } as const;
const FULL_BACK = { area: "defence", lane: "left" } as const;
const POACHER: RoleScoring = {
  role: "poacher",
  bonus: { parts: [{ stat: "att_ibox_goal", weight: 2 }, { stat: "att_ibox_target", weight: 1 }], bars: [2, 3, 4] },
  cost: { parts: [{ stat: "big_chance_missed", weight: 1 }], bars: [1, 4, 7] },
};
const TARGET_MAN: RoleScoring = {
  role: "targetMan",
  bonus: { parts: [{ stat: "aerial_won", weight: 1 }], bars: [4, 5, 6] },
  cost: { parts: [{ stat: "aerial_lost", weight: 1 }], bars: [5, 8, 11] },
};
const SET: ScoringSet = { ...FIRST_SCORING, roles: [POACHER, TARGET_MAN] };
/** spec/05's example: one goal in the box (counts 2) and one more shot on target there, so 3 and
 *  +2, but a big chance missed, −1. */
const RECORD = { minutes: 90, goals_scored: 1, att_ibox_goal: 1, att_ibox_target: 1, big_chance_missed: 1, aerial_won: 2 };

describe("a starter's role", () => {
  test("adds +1 at each bonus bar and −1 at each cost bar to his base points", () => {
    const base = scoreMatch(RECORD, SET, STRIKER);
    const poacher = scoreMatch(RECORD, SET, STRIKER, "poacher");
    expect(poacher.total).toBe(base.total! + 1);
    expect(poacher.role).toEqual({
      role: "poacher",
      points: 1,
      sides: [
        { side: "bonus", points: 2, lines: [{ stat: "att_ibox_goal", actions: 1 }, { stat: "att_ibox_target", actions: 1 }] },
        { side: "cost", points: -1, lines: [{ stat: "big_chance_missed", actions: 1 }] },
      ],
    });
    expect(poacher.categories).toEqual(base.categories);
  });

  test("scores the same player and match differently in two roles", () => {
    expect(scoreMatch(RECORD, SET, STRIKER, "poacher").total).not.toBe(scoreMatch(RECORD, SET, STRIKER, "targetMan").total);
    expect(scoreMatch(RECORD, SET, STRIKER, "targetMan").role).toEqual({ role: "targetMan", points: 0, sides: [] });
  });

  test("never moves a match by more than 3 either way", () => {
    const huge = { minutes: 90, att_ibox_goal: 20, att_ibox_target: 20, aerial_won: 0 };
    expect(scoreMatch(huge, SET, STRIKER, "poacher").role?.points).toBe(ROLE_BARS_MOST);
    expect(scoreMatch({ minutes: 90, big_chance_missed: 50 }, SET, STRIKER, "poacher").role?.points).toBe(-ROLE_BARS_MOST);
  });

  test("counts for a cameo as for 90 minutes: 4 minutes and a big chance missed is −1", () => {
    expect(scoreMatch({ minutes: 4, big_chance_missed: 1 }, SET, STRIKER, "poacher").role?.points).toBe(-1);
  });

  test("weighs each stat: 70 accurate passes at ÷ 10 reach a bar at 7, 69 don't", () => {
    const metronome: ScoringSet = {
      ...FIRST_SCORING,
      roles: [{ role: "metronome", bonus: { parts: [{ stat: "accurate_pass", weight: 0.1 }], bars: [7] }, cost: { parts: [{ stat: "fouls", weight: 1 }], bars: [1] } }],
    };
    const dm = { area: "defensiveMidfield", lane: "centre" } as const;
    expect(scoreMatch({ minutes: 90, accurate_pass: 70 }, metronome, dm, "metronome").role?.points).toBe(1);
    expect(scoreMatch({ minutes: 90, accurate_pass: 69 }, metronome, dm, "metronome").role?.points).toBe(0);
  });

  test("scores nothing for a role the set doesn't name, or for no role", () => {
    expect(scoreMatch(RECORD, SET, STRIKER, "falseNine")).toEqual(scoreMatch(RECORD, SET, STRIKER));
    expect(scoreMatch(RECORD, FIRST_SCORING, STRIKER, "poacher")).toEqual(scoreMatch(RECORD, FIRST_SCORING, STRIKER));
  });

  test("a record not yet arrived scores null, with no role line", () => {
    const pending = scoreMatch(null, SET, STRIKER, "poacher");
    expect(pending.total).toBeNull();
    expect(pending.role).toBeUndefined();
  });

  test("counts in a team's total, a starter with no role given playing the slot's first", () => {
    const full: ScoringSet = { ...FIRST_SCORING, roles: [{ ...POACHER, role: "overlappingFullBack" }] };
    const lineup = { starters: [{ playerCode: 1, ...FULL_BACK }], bench: [] };
    const matches = new Map([[1, [{ record: RECORD, final: true }]]]);
    const team = scoreTeam({ lineup, matches, set: full, doubleGameweekRule: "bothMatches", substitutions: [], benchCells: new Map() });
    expect(team.total).toBe(scoreMatch(RECORD, FIRST_SCORING, FULL_BACK).total! + 1);
    // The slot says the role it was priced in, so the commentary can price his lines in it too.
    expect(team.starters[0].role).toBe("overlappingFullBack");
  });
});

describe("a set's roles are checked", () => {
  const bad = (roles: unknown) => () => validateScoringSet({ ...FIRST_SCORING, roles });
  const side = { parts: [{ stat: "goals_scored", weight: 1 }], bars: [1, 2, 3] };

  test.each<[string, unknown, RegExp]>([
    ["no role", [{ role: "", bonus: side, cost: side }], /names no role/],
    ["a role twice", [{ role: "poacher", bonus: side, cost: side }, { role: "poacher", bonus: side, cost: side }], /scored twice/],
    ["a stat the catalogue doesn't hold", [{ role: "poacher", bonus: { ...side, parts: [{ stat: "goals_scroed", weight: 1 }] }, cost: side }], /neither a catalogue stat/],
    ["no stats", [{ role: "poacher", bonus: { ...side, parts: [] }, cost: side }], /adds up no stats/],
    ["a weight of 0", [{ role: "poacher", bonus: side, cost: { ...side, parts: [{ stat: "fouls", weight: 0 }] } }], /not above 0/],
    ["four bars", [{ role: "poacher", bonus: { ...side, bars: [1, 2, 3, 4] }, cost: side }], /1 to 3 bars/],
    ["no bars", [{ role: "poacher", bonus: side, cost: { ...side, bars: [] } }], /1 to 3 bars/],
    ["bars not rising", [{ role: "poacher", bonus: { ...side, bars: [2, 2, 3] }, cost: side }], /bar at 2, not above 2/],
  ])("refuses %s", (_, roles, reason) => {
    expect(bad(roles)).toThrow(reason);
  });
});

describe("the first values (docs/roles-first-values.md)", () => {
  const firstSet: ScoringSet = { ...FIRST_SCORING, ownStats: [...FIRST_ROLE_OWN_STATS], roles: [...FIRST_ROLES] };

  test("are a sound set, scoring every default role once", () => {
    expect(() => validateScoringSet(firstSet)).not.toThrow();
    const keys = new Set(Object.values(DEFAULT_ROLES).flat().map(({ key }) => key));
    expect(FIRST_ROLES.map(({ role }) => role).toSorted()).toEqual([...keys].toSorted());
  });

  test("a failed count is the total less the accurate: 6 long balls, 2 accurate, is 4 failed, the wide playmaker's first cost bar", () => {
    const wide = { area: "midfield", lane: "left" } as const;
    expect(scoreMatch({ minutes: 90, total_long_balls: 6, accurate_long_balls: 2 }, firstSet, wide, "wideMidfieldPlaymaker").role).toEqual({
      role: "wideMidfieldPlaymaker",
      points: 0,
      sides: [
        { side: "bonus", points: 1, lines: [{ stat: "accurate_long_balls", actions: 2 }] },
        { side: "cost", points: -1, lines: [{ stat: "league:failed_long_balls", actions: 4 }] },
      ],
    });
  });

  test("aren't in the first set, which the gameweeks before them keep", () => {
    expect(FIRST_SCORING.roles).toBeUndefined();
  });
});

test("a patch that changes a role says so in its notes, bars and mix", () => {
  const stored = structuredClone({ ...FIRST_SCORING, roles: [POACHER] }) as StoredScoringSet;
  expect(scoringChanges(FIRST_SCORING, stored)).toEqual(["Poacher: now +1 at 2, +2 at 3, +3 at 4 of 2 × Att ibox goal + Att ibox target; −1 at 1, −2 at 4, −3 at 7 of Big chance missed"]);
  expect(scoringChanges(stored, FIRST_SCORING)).toEqual(["Poacher: no longer scored"]);
});

test("two roles of one name are told apart in patch notes by their position", () => {
  const winger = (role: string) => ({ ...TARGET_MAN, role });
  const both = structuredClone({ ...FIRST_SCORING, roles: [winger("wideMidfieldWinger"), winger("winger")] }) as StoredScoringSet;
  expect(scoringChanges(FIRST_SCORING, both)).toEqual([
    "Touchline winger (wide midfield): now +1 at 4, +2 at 5, +3 at 6 of Aerial won; −1 at 5, −2 at 8, −3 at 11 of Aerial lost",
    "Touchline winger (attacking midfield, wide): now +1 at 4, +2 at 5, +3 at 6 of Aerial won; −1 at 5, −2 at 8, −3 at 11 of Aerial lost",
  ]);
});

describe("a role, at the edges of a team", () => {
  const BACK: ScoringSet = { ...FIRST_SCORING, roles: [{ ...TARGET_MAN, role: "defensiveFullBack" }] };
  const AERIAL = { minutes: 90, aerial_won: 5 };
  const lineup = { starters: [{ playerCode: 1, ...FULL_BACK, role: "defensiveFullBack" }], bench: [2] };
  const team = (override?: number, substitutions: { off: number; on: number; cell: typeof FULL_BACK; role?: string }[] = []) =>
    scoreTeam({
      lineup,
      matches: new Map([
        [1, [{ record: AERIAL, final: true, ...(override === undefined ? {} : { override }) }]],
        [2, [{ record: AERIAL, final: true }]],
      ]),
      set: BACK,
      doubleGameweekRule: "bothMatches",
      substitutions,
      benchCells: new Map([[2, FULL_BACK]]),
    });

  test("an overridden match keeps the override as its whole score, with no role line", () => {
    const [starter] = team(9).starters;
    expect(starter.points).toBe(9);
    expect(starter.matches[0].role).toBeUndefined();
  });

  test("a sub into the empty slot plays the role he's given there", () => {
    const subbed = team(undefined, [{ off: 1, on: 2, cell: FULL_BACK, role: "defensiveFullBack" }]);
    expect(subbed.bench[0].matches[0].role?.role).toBe("defensiveFullBack");
    expect(subbed.bench[0].role).toBe("defensiveFullBack");
  });
});

describe("a sweeper is priced as CB (spec/14; #844)", () => {
  const SWEEPER_SLOT = { area: "defence", lane: "centre" } as const;
  const BESIDE = { area: "defence", lane: "leftCentre" } as const;
  const DEFENDER = { minutes: 90, clean_sheets: 1, goals_scored: 1, effective_clearance: 4, won_tackle: 2 };

  test("with no scoring for his role, a sweeper and a libero score as a centre-back does, in his cell or beside it", () => {
    const asCentreBack = scoreMatch(DEFENDER, FIRST_SCORING, BESIDE);
    for (const role of ["sweeper", "libero", "stopper", undefined]) {
      expect(scoreMatch(DEFENDER, FIRST_SCORING, SWEEPER_SLOT, role)).toEqual(asCentreBack);
    }
  });

  test("a team's total with a sweeper in the middle is its total with a stopper there", () => {
    const total = (role: string) =>
      scoreTeam({
        lineup: { starters: [{ playerCode: 1, ...SWEEPER_SLOT, role }], bench: [] },
        matches: new Map([[1, [{ record: DEFENDER, final: true }]]]),
        set: FIRST_SCORING,
        doubleGameweekRule: "bothMatches",
        substitutions: [],
        benchCells: new Map(),
      }).total;
    expect(total("sweeper")).toBe(total("stopper"));
  });
});
