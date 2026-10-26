// The lineup being set on the Tactics tab (#14), before it is saved: moves between cells and the
// bench, and when two lineups stand the same.

import { describe, expect, it } from "vitest";
import { benched, openingLineup, placed, sameLineup, withSquad } from "../../../src/myTeam/lineupDraft";

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
});

describe("the same lineup", () => {
  it("is the same players in the same cells whatever order the starters are listed in", () => {
    expect(sameLineup(DRAFT, { starters: [BACK, KEEPER], bench: [3, 4] })).toBe(true);
  });

  it("isn't with the bench in another order", () => {
    expect(sameLineup(DRAFT, { starters: [KEEPER, BACK], bench: [4, 3] })).toBe(false);
  });
});

it("for a team that has never saved one opens with the whole squad on the bench, in the order it joined", () => {
  const squad = [7, 5, 6].map((playerCode) => ({ playerCode, name: `${playerCode}`, clubShortName: "ARS", positions: [] }));
  expect(openingLineup({ squad, lineup: { kind: "none" } })).toEqual({ starters: [], bench: [7, 5, 6] });
});

it("against the squad now drops who left and puts who joined at the end of the bench", () => {
  expect(withSquad(DRAFT, [1, 3, 4, 9])).toEqual({ starters: [KEEPER], bench: [3, 4, 9] });
});
