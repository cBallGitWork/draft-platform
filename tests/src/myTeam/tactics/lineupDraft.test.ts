// The lineup being set on the Tactics tab (#14), before it is saved: moves between cells and the
// bench, and when two lineups stand the same.

import { describe, expect, it } from "vitest";
import type { Cell } from "../../../../convex/lineup/pitch";
import { benched, benchedAt, openingLineup, placed, reshaped, sameLineup, shownLineup, withRole } from "../../../../src/myTeam/tactics/lineupDraft";

const KEEPER = { playerCode: 1, area: "goalkeeper", lane: "centre" } as const;
const BACK = { playerCode: 2, area: "defence", lane: "left" } as const;
const DRAFT = { starters: [KEEPER, BACK], bench: [3, 4] };

describe("a move", () => {
  it("off the bench into a free cell makes him a starter", () => {
    expect(placed(DRAFT, 3, { area: "midfield", lane: "centre" })).toEqual({
      starters: [KEEPER, BACK, { playerCode: 3, area: "midfield", lane: "centre" }],
      bench: [4],
    });
  });

  it("into a cell another player stands in throws: the screen offers only free ones", () => {
    expect(() => placed(DRAFT, 3, { area: "defence", lane: "left" })).toThrow(/taken by player 2/);
  });

  it("to the bench puts him at its end", () => {
    expect(benched(DRAFT, 2)).toEqual({ starters: [KEEPER], bench: [3, 4, 2] });
  });

  it("to a place on the bench puts him there, from the pitch or along the bench", () => {
    expect(benchedAt(DRAFT, 2, 0)).toEqual({ starters: [KEEPER], bench: [2, 3, 4] });
    expect(benchedAt(DRAFT, 3, 1)).toEqual({ starters: [KEEPER, BACK], bench: [4, 3] }); // down one
    expect(benchedAt(DRAFT, 4, 0)).toEqual({ starters: [KEEPER, BACK], bench: [4, 3] }); // up one
  });

  it("past either end of the bench is that end", () => {
    expect(benchedAt(DRAFT, 2, -1).bench).toEqual([2, 3, 4]);
    expect(benchedAt(DRAFT, 3, 9).bench).toEqual([4, 3]);
  });
});

describe("the same lineup", () => {
  it("is the same players in the same cells whatever order the starters are listed in", () => {
    expect(sameLineup(DRAFT, { starters: [BACK, KEEPER], bench: [3, 4] })).toBe(true);
  });

  it("isn't with the bench in another order", () => {
    expect(sameLineup(DRAFT, { starters: [KEEPER, BACK], bench: [4, 3] })).toBe(false);
  });
});

it("opens on the lineup the server holds, a team's first until its manager saves one (spec/05)", () => {
  const lineup = { fromGameweek: null, noLineup: false, starters: [KEEPER], bench: [7, 5, 6], leftSquad: [], joinedBench: [], vacated: [] };
  expect(openingLineup({ lineup })).toEqual({ starters: [KEEPER], bench: [7, 5, 6] });
});

describe("the lineup shown", () => {
  /** The lineup the server holds, which the screen opened on. */
  const OPENING = { starters: [KEEPER], bench: [2, 3, 4] };

  it("is the manager's edit against the squad now: who left drops out and who joined goes to the end of the bench", () => {
    expect(shownLineup(DRAFT, OPENING, [1, 3, 4, 9])).toEqual({ starters: [KEEPER], bench: [3, 4, 9] });
  });

  it("is the held lineup while there is no edit", () => {
    expect(shownLineup(null, OPENING, [1, 3, 4, 9])).toBe(OPENING);
  });
});

describe("a preset picked (spec/05; Craig, 26 Oct 2026)", () => {
  const cell = (area: Cell["area"], lane: Cell["lane"]) => ({ area, lane });
  const FOUR_BACK = [cell("goalkeeper", "centre"), cell("defence", "left"), cell("defence", "leftCentre"), cell("defence", "rightCentre"), cell("defence", "right")];

  it("moves each starter to a free cell of the shape in his own area, the nearest lane first", () => {
    const draft = { starters: [KEEPER, { playerCode: 2, area: "defence", lane: "centre" } as const], bench: [3] };
    expect(reshaped(draft, FOUR_BACK)).toEqual({
      starters: [KEEPER, { playerCode: 2, area: "defence", lane: "leftCentre" }],
      bench: [3],
    });
  });

  it("puts anyone the shape has no room for at the front of the bench, back to front", () => {
    const draft = {
      starters: [KEEPER, { playerCode: 5, area: "attack", lane: "centre" } as const, { playerCode: 6, area: "midfield", lane: "left" } as const],
      bench: [3],
    };
    expect(reshaped(draft, FOUR_BACK)).toEqual({ starters: [KEEPER], bench: [6, 5, 3] });
  });

  it("two starters in an area take its cells in turn, never the same one", () => {
    const draft = { starters: [{ playerCode: 2, area: "defence", lane: "left" } as const, { playerCode: 7, area: "defence", lane: "leftCentre" } as const], bench: [] };
    const result = reshaped(draft, [cell("defence", "left"), cell("defence", "right")]);
    expect(result.starters).toEqual([{ playerCode: 2, area: "defence", lane: "left" }, { playerCode: 7, area: "defence", lane: "right" }]);
  });
});

describe("a role (spec/05 Roles)", () => {
  it("given, is the starter's until he moves; the same lineup with another role isn't the same", () => {
    const given = withRole(DRAFT, 2, "attackingFullBack");
    expect(given.starters[1]).toEqual({ ...BACK, role: "attackingFullBack" });
    expect(sameLineup(given, DRAFT)).toBe(false);
    expect(placed(given, 2, { area: "defence", lane: "centre" }).starters.at(-1)).toEqual({ playerCode: 2, area: "defence", lane: "centre" });
  });

  it("kept by a preset that puts him in a slot offering it, dropped where it isn't offered", () => {
    const given = withRole(DRAFT, 2, "attackingFullBack");
    expect(reshaped(given, [KEEPER, { area: "defence", lane: "left" }]).starters[1]).toEqual({ ...BACK, role: "attackingFullBack" });
    expect(reshaped(given, [KEEPER, { area: "defence", lane: "centre" }]).starters[1]).toEqual({ playerCode: 2, area: "defence", lane: "centre" });
  });
});
