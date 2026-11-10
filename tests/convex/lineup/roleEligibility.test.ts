import { describe, expect, test } from "vitest";
import { lineupProblems } from "../../../convex/lineup/lineup";
import { problemWords } from "../../../convex/lineup/lineupWords";
import { rolesFor, takesRole } from "../../../convex/lineup/roles";
import { filledLineup, openLimits, presetNamed, withPositions } from "../../support/convex/lineup.harness";

// Who may take a role (spec/05 `S05.29`; Craig, 9 and 10 Nov 2026, on #1196): the attack's roles go
// to an ST or SS; a CAM up front is false 9 only; a winger never takes a striker role; the pressing
// winger goes to a W only. A role a player can't take isn't offered to him.

const FOUR_FOUR_TWO = presetNamed("4-4-2").cells;
const FOUR_TWO_THREE_ONE = presetNamed("4-2-3-1").cells;
const STRIKER = { area: "attack", lane: "leftCentre" } as const;
const LEFT_WINGER = { area: "attackingMidfield", lane: "left" } as const;
const keys = (roles: readonly { key: string }[]) => roles.map(({ key }) => key);

describe("the roles offered him", () => {
  test("up front: every attack role to an ST or SS, the false 9 alone to a CAM", () => {
    expect(keys(rolesFor(STRIKER, FOUR_FOUR_TWO, ["ST"]))).toEqual(["poacher", "targetMan", "inBehindStriker", "pressingForward", "falseNine"]);
    expect(keys(rolesFor(STRIKER, FOUR_FOUR_TWO, ["SS"]))).toHaveLength(5);
    expect(keys(rolesFor(STRIKER, FOUR_FOUR_TWO, ["CAM"]))).toEqual(["falseNine"]);
  });

  test("a winger never takes a striker role, the false 9 either", () => {
    for (const role of ["poacher", "falseNine"]) expect(takesRole(["W"], role), role).toBe(false);
    expect(takesRole(["W", "ST"], "poacher")).toBe(true);
  });

  test("the pressing winger goes to a W only: a wide midfielder out wide in attacking midfield isn't offered it", () => {
    expect(keys(rolesFor(LEFT_WINGER, FOUR_TWO_THREE_ONE, ["W"]))).toContain("pressingWinger");
    expect(keys(rolesFor(LEFT_WINGER, FOUR_TWO_THREE_ONE, ["WM"]))).toEqual(["winger", "dribbler", "insideForward", "widePlaymaker", "trackingWinger"]);
  });

  test("any other role goes to whoever stands in its slot, and every role to one whose positions aren't known", () => {
    expect(takesRole(["CB"], "stopper")).toBe(true);
    expect(takesRole([], "poacher")).toBe(true);
  });
});

describe("a lineup with a starter on a role he can't take", () => {
  const { lineup, positions } = filledLineup(presetNamed("4-4-2"));
  const striker = lineup.starters.find((starter) => starter.area === "attack")!;
  const asCam = withPositions(positions, striker.playerCode, ["CAM"]);
  const onRole = (role: string | undefined) => ({
    ...lineup,
    starters: lineup.starters.map((starter) => (starter === striker ? { ...starter, role } : starter)),
  });

  test("a CAM up front stands as false 9", () => {
    expect(lineupProblems(onRole("falseNine"), asCam, openLimits())).toEqual([]);
  });

  test("on any other attack role, the slot's first included, it is refused, said in words", () => {
    const problems = lineupProblems(onRole("targetMan"), asCam, openLimits());
    expect(problems).toEqual([{ kind: "roleNotHis", playerCode: striker.playerCode, role: "targetMan", positions: ["CAM"] }]);
    expect(problemWords(problems[0], (code) => `Player ${code}`)).toBe(`Player ${striker.playerCode} plays CAM, so he can't play Target man.`);
    expect(lineupProblems(onRole(undefined), asCam, openLimits())).toMatchObject([{ kind: "roleNotHis", role: "poacher" }]);
  });
});
