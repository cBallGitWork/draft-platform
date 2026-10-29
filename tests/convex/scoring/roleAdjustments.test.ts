import { describe, expect, test } from "vitest";
import { DRAFTED_ROLE_ADJUSTMENTS } from "../../../convex/scoring/draftedRoleAdjustments";
import { DEFAULT_ROLES } from "../../../convex/lineup/roles";
import { scoringChanges } from "../../../convex/scoring/patchChanges";
import { scoreMatch } from "../../../convex/scoring/scoring";
import { validateScoringSet, type ScoringSet } from "../../../convex/scoring/scoringSet";
import type { StoredScoringSet } from "../../../convex/scoring/scoringSetShape";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { scoreTeam } from "../../../convex/scoring/teamPoints";

// Role adjustments (#10, spec/05 Roles; spec/14: "a points limit holds only the rule's own points:
// a role's adjustment is added on top"; Craig, 26 Oct 2026: base points and a role adjustment).

const FULL_BACK = { area: "defence", lane: "left" } as const;
const SET: ScoringSet = { ...FIRST_SCORING, roleAdjustments: [{ role: "attackingFullBack", adjustments: [{ stat: "accurate_cross", points: 1 }, { stat: "clean_sheets", points: -1 }] }] };
const RECORD = { minutes: 90, accurate_cross: 2, clean_sheets: 1 };

describe("a starter's role adjustment", () => {
  test("is added to his base points: two crosses +2, a clean sheet −1", () => {
    const base = scoreMatch(RECORD, SET, FULL_BACK);
    const adjusted = scoreMatch(RECORD, SET, FULL_BACK, "attackingFullBack");
    expect(adjusted.total).toBe(base.total! + 1);
    expect(adjusted.role).toEqual({
      role: "attackingFullBack",
      points: 1,
      lines: [
        { stat: "accurate_cross", actions: 2, points: 2 },
        { stat: "clean_sheets", actions: 1, points: -1 },
      ],
    });
    expect(adjusted.categories).toEqual(base.categories);
  });

  test("adjusts nothing for a role the set doesn't name, or for no role", () => {
    expect(scoreMatch(RECORD, SET, FULL_BACK, "defensiveFullBack")).toEqual(scoreMatch(RECORD, SET, FULL_BACK));
    expect(scoreMatch(RECORD, FIRST_SCORING, FULL_BACK, "attackingFullBack")).toEqual(scoreMatch(RECORD, FIRST_SCORING, FULL_BACK));
  });

  test("lists only the stats he made", () => {
    expect(scoreMatch({ minutes: 90, accurate_cross: 1 }, SET, FULL_BACK, "attackingFullBack").role?.lines).toEqual([{ stat: "accurate_cross", actions: 1, points: 1 }]);
  });

  test("counts in a team's total, a starter with no role given playing the slot's first", () => {
    const defensiveFirst: ScoringSet = { ...SET, roleAdjustments: [{ role: "defensiveFullBack", adjustments: [{ stat: "accurate_cross", points: 5 }] }] };
    const lineup = { starters: [{ playerCode: 1, ...FULL_BACK }], bench: [] };
    const matches = new Map([[1, [{ record: RECORD, final: true }]]]);
    const team = scoreTeam({ lineup, matches, set: defensiveFirst, doubleGameweekRule: "bothMatches", substitutions: [], benchCells: new Map() });
    expect(team.total).toBe(scoreMatch(RECORD, FIRST_SCORING, FULL_BACK).total! + 10);
  });
});

describe("a set's role adjustments are checked", () => {
  test("a stat the catalogue doesn't hold, a role twice and a fraction where points are whole are refused", () => {
    const bad = (roleAdjustments: unknown, wholePointsOnly = false) => () => validateScoringSet({ ...FIRST_SCORING, wholePointsOnly, roleAdjustments });
    expect(bad([{ role: "poacher", adjustments: [{ stat: "goals_scroed", points: 1 }] }])).toThrow(/neither a catalogue stat/);
    expect(bad([{ role: "poacher", adjustments: [] }, { role: "poacher", adjustments: [] }])).toThrow(/adjusted twice/);
    expect(bad([{ role: "poacher", adjustments: [{ stat: "goals_scored", points: 0.5 }] }], true)).toThrow();
  });

  test("Claude's draft is a sound set, one adjustment for every default role, each giving and taking", () => {
    expect(() => validateScoringSet({ ...FIRST_SCORING, roleAdjustments: DRAFTED_ROLE_ADJUSTMENTS })).not.toThrow();
    const keys = new Set(Object.values(DEFAULT_ROLES).flat().map(({ key }) => key));
    expect(new Set(DRAFTED_ROLE_ADJUSTMENTS.map(({ role }) => role))).toEqual(keys);
    for (const { adjustments } of DRAFTED_ROLE_ADJUSTMENTS) {
      expect(adjustments.some(({ points }) => points > 0) && adjustments.some(({ points }) => points < 0)).toBe(true);
    }
  });

  test("isn't in the first set: no gameweek's points move until a patch brings it", () => {
    expect(FIRST_SCORING.roleAdjustments).toBeUndefined();
  });
});

test("a patch that adjusts a role says so in its notes", () => {
  const stored = structuredClone(SET) as StoredScoringSet;
  expect(scoringChanges(FIRST_SCORING, stored)).toEqual(["Attacking full-back: now +1 per Accurate cross, −1 per Clean sheets"]);
  expect(scoringChanges(stored, FIRST_SCORING)).toEqual(["Attacking full-back: no longer adjusted"]);
});

describe("a role adjustment, at the edges", () => {
  test("a record not yet arrived scores null, with no role line", () => {
    const pending = scoreMatch(null, SET, FULL_BACK, "attackingFullBack");
    expect(pending.total).toBeNull();
    expect(pending.role).toBeUndefined();
  });

  test("a fraction is kept in tenths: 0.1 a cross, three crosses, 0.3", () => {
    const tenth: ScoringSet = { ...FIRST_SCORING, roleAdjustments: [{ role: "attackingFullBack", adjustments: [{ stat: "accurate_cross", points: 0.1 }] }] };
    expect(scoreMatch({ minutes: 90, accurate_cross: 3 }, tenth, FULL_BACK, "attackingFullBack").role?.points).toBe(0.3);
  });

  const lineup = { starters: [{ playerCode: 1, ...FULL_BACK, role: "attackingFullBack" }], bench: [2] };
  const team = (override?: number, substitutions: { off: number; on: number; cell: typeof FULL_BACK; role?: string }[] = []) =>
    scoreTeam({
      lineup,
      matches: new Map([
        [1, [{ record: RECORD, final: true, ...(override === undefined ? {} : { override }) }]],
        [2, [{ record: RECORD, final: true }]],
      ]),
      set: SET,
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
    const subbed = team(undefined, [{ off: 1, on: 2, cell: FULL_BACK, role: "attackingFullBack" }]);
    expect(subbed.bench[0].matches[0].role?.role).toBe("attackingFullBack");
  });
});

test("two roles of one name are told apart in patch notes by their position", () => {
  const both = structuredClone({ ...FIRST_SCORING, roleAdjustments: [
    { role: "wideMidfielder", adjustments: [{ stat: "accurate_cross", points: 1 }] },
    { role: "winger", adjustments: [{ stat: "accurate_cross", points: 1 }] },
  ] }) as StoredScoringSet;
  expect(scoringChanges(FIRST_SCORING, both)).toEqual([
    "Winger (wide midfield): now +1 per Accurate cross",
    "Winger (attacking midfield, wide): now +1 per Accurate cross",
  ]);
});
