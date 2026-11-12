// What a league plays, asked in one place (#1582): every league plays roles, instructions and
// stars and the higher score wins; matchups come from its format. With an answer forced false, the
// scorer adds no role or instruction points. No league can reach that state yet.
import { describe, expect, test } from "vitest";
import { gameModeOf, playedSet } from "../../../convex/rules/gameMode";
import { scoreMatch } from "../../../convex/scoring/scoring";
import type { ScoringSet } from "../../../convex/scoring/scoringSet";
import { EXAMPLE_SET, GOAL_AND_ASSIST, pricedRole } from "../../support/convex/scoring.example";

const SET: ScoringSet = {
  ...structuredClone(EXAMPLE_SET),
  roles: [pricedRole("poacher", "goals_scored", 1)],
  instructions: [{ instruction: "shootOnSight", lines: [{ stats: [{ stat: "goals_scored", weight: 1 }], every: 1, points: 1 }] }],
};
const STRIKER = { area: "attack", lane: "centre" } as const;
const TEAM = { instructions: ["shootOnSight"], backLine: null };
const PLAYS_ALL = { scoresRoles: true, scoresInstructions: true };

describe("gameModeOf", () => {
  test("every league plays roles, instructions and stars, and the higher score wins", () => {
    for (const format of ["headToHead", "totalPoints"] as const) {
      expect(gameModeOf({ format })).toMatchObject({ scoresRoles: true, scoresInstructions: true, showsStars: true, higherWins: true });
    }
  });

  test("a league has matchups when it plays head-to-head", () => {
    expect(gameModeOf({ format: "headToHead" }).hasMatchups).toBe(true);
    expect(gameModeOf({ format: "totalPoints" }).hasMatchups).toBe(false);
  });
});

describe("playedSet", () => {
  const scored = (mode: typeof PLAYS_ALL) => scoreMatch(GOAL_AND_ASSIST, playedSet(SET, mode), STRIKER, "poacher", TEAM);
  const base = scoreMatch(GOAL_AND_ASSIST, EXAMPLE_SET, STRIKER).total!;

  test("a league playing both gets the very set read, its role and instruction points added", () => {
    expect(playedSet(SET, PLAYS_ALL)).toBe(SET);
    expect(scored(PLAYS_ALL)).toMatchObject({ total: base + 2, role: { points: 1 }, instructions: [{ points: 1 }] });
  });

  test("with roles off, no role points", () => {
    const points = scored({ ...PLAYS_ALL, scoresRoles: false });
    expect(points.role).toBeUndefined();
    expect(points.total).toBe(base + 1);
  });

  test("with instructions off, no instruction points", () => {
    const points = scored({ ...PLAYS_ALL, scoresInstructions: false });
    expect(points.instructions).toBeUndefined();
    expect(points.total).toBe(base + 1);
  });
});
