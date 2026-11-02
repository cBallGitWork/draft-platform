// A preset picked on the Tactics tab (spec/05, The pitch): the lineup reshaped to its cells, the
// bench filling what is left, and, for now, the last slots filled out of position (#1025).

import { describe, expect, it } from "vitest";
import type { Cell } from "../../../../convex/lineup/pitch";
import type { Position } from "../../../../convex/positions/positionTables";
import { reshaped } from "../../../../src/myTeam/tactics/lineupDraft";
import { KEEPER, NO_STARS, PLAYS } from "../../../support/src/lineupDraft.harness";

describe("a preset picked (spec/05; Craig, 26 Oct 2026)", () => {
  const cell = (area: Cell["area"], lane: Cell["lane"]) => ({ area, lane });
  const FOUR_BACK = [cell("goalkeeper", "centre"), cell("defence", "left"), cell("defence", "leftCentre"), cell("defence", "rightCentre"), cell("defence", "right")];

  it("moves each starter to a free cell of the shape in his own area, the nearest lane first", () => {
    const draft = { starters: [KEEPER, { playerCode: 2, area: "defence", lane: "centre" } as const], bench: [3] };
    expect(reshaped(draft, FOUR_BACK, PLAYS, NO_STARS)).toEqual({
      starters: [KEEPER, { playerCode: 2, area: "defence", lane: "leftCentre" }],
      bench: [3],
    });
  });

  it("puts anyone the shape has no room for at the front of the bench, back to front", () => {
    const draft = {
      starters: [KEEPER, { playerCode: 5, area: "attack", lane: "centre" } as const, { playerCode: 6, area: "midfield", lane: "left" } as const],
      bench: [3],
    };
    // Only the goal, so no outfield slot is left for them to fill out of position (#1025).
    expect(reshaped(draft, [KEEPER], PLAYS, NO_STARS)).toEqual({ starters: [KEEPER], bench: [6, 5, 3] });
  });

  it("two starters in an area take its cells in turn, never the same one", () => {
    const draft = { starters: [{ playerCode: 2, area: "defence", lane: "left" } as const, { playerCode: 7, area: "defence", lane: "leftCentre" } as const], bench: [] };
    const result = reshaped(draft, [cell("defence", "left"), cell("defence", "right")], PLAYS, NO_STARS);
    expect(result.starters).toEqual([{ playerCode: 2, area: "defence", lane: "left" }, { playerCode: 7, area: "defence", lane: "right" }]);
  });

  it("moves a starter with no room in his area to the nearest one he plays: 4-4-2's midfield into 4-2-3-1's holding pair (Craig, 1 Nov 2026)", () => {
    const draft = { starters: [KEEPER, { playerCode: 8, area: "midfield", lane: "leftCentre" } as const], bench: [3] };
    expect(reshaped(draft, [KEEPER, cell("defensiveMidfield", "leftCentre"), cell("defensiveMidfield", "rightCentre")], PLAYS, NO_STARS)).toEqual({
      starters: [KEEPER, { playerCode: 8, area: "defensiveMidfield", lane: "leftCentre" }],
      bench: [3],
    });
  });

  it("takes the deeper of two areas as near as each other", () => {
    const draft = { starters: [{ playerCode: 10, area: "midfield", lane: "centre" } as const], bench: [] };
    expect(reshaped(draft, [cell("defensiveMidfield", "centre"), cell("attackingMidfield", "centre")], PLAYS, NO_STARS).starters).toEqual([
      { playerCode: 10, area: "defensiveMidfield", lane: "centre" },
    ]);
  });

  it("fills everyone's own area first, so a player moved across never takes the cell its own player needed", () => {
    const draft = { starters: [{ playerCode: 9, area: "defence", lane: "left" } as const, { playerCode: 8, area: "defensiveMidfield", lane: "centre" } as const], bench: [] };
    expect(reshaped(draft, [cell("defensiveMidfield", "centre")], PLAYS, NO_STARS)).toEqual({
      starters: [{ playerCode: 8, area: "defensiveMidfield", lane: "centre" }],
      bench: [9],
    });
  });

  it("never puts a starter in a cell of his own area he doesn't play", () => {
    // 12, a centre midfielder on the bench, takes the cell the wing back doesn't play.
    const wingBack = { positionsOf: (playerCode: number): Position[] => (playerCode === 4 ? ["WB"] : ["CM"]) };
    const draft = { starters: [{ playerCode: 4, area: "midfield", lane: "left" } as const], bench: [12] };
    expect(reshaped(draft, [cell("midfield", "centre")], wingBack, NO_STARS)).toEqual({
      starters: [{ playerCode: 12, area: "midfield", lane: "centre" }],
      bench: [4],
    });
  });
});

describe("a preset picked fills its empty slots from the bench (Craig, 1 Nov 2026; #1025)", () => {
  const cell = (area: Cell["area"], lane: Cell["lane"]) => ({ area, lane });

  it("takes bench players who play an empty slot, in bench order, and leaves the rest on the bench", () => {
    const draft = { starters: [KEEPER], bench: [3, 5, 2, 7] };
    const shape = [KEEPER, cell("defence", "left"), cell("attack", "centre")];
    expect(reshaped(draft, shape, PLAYS, NO_STARS)).toEqual({
      starters: [KEEPER, { playerCode: 5, area: "attack", lane: "centre" }, { playerCode: 2, area: "defence", lane: "left" }],
      bench: [3, 7],
    });
  });

  it("puts a winger benched by a 4-4-2 back in its wide midfield", () => {
    const winger = { positionsOf: () => ["W"] as Position[] };
    const draft = { starters: [{ playerCode: 11, area: "attackingMidfield", lane: "left" } as const], bench: [] };
    expect(reshaped(draft, [cell("midfield", "left")], winger, NO_STARS).starters).toEqual([{ playerCode: 11, area: "midfield", lane: "left" }]);
  });
});

describe("a preset the squad can't fill is never refused: its last slots fill out of position (Craig, 2 Nov 2026; #1025)", () => {
  const cell = (area: Cell["area"], lane: Cell["lane"]) => ({ area, lane });

  it("a back three picked with one defender: the bench fills the other two, in bench order, back to front", () => {
    const draft = { starters: [KEEPER, { playerCode: 2, area: "defence", lane: "centre" } as const], bench: [5, 3, 6] };
    const backThree = [KEEPER, cell("defence", "leftCentre"), cell("defence", "centre"), cell("defence", "rightCentre")];
    expect(reshaped(draft, backThree, PLAYS, NO_STARS)).toEqual({
      starters: [KEEPER, { playerCode: 2, area: "defence", lane: "centre" }, { playerCode: 5, area: "defence", lane: "leftCentre" }, { playerCode: 6, area: "defence", lane: "rightCentre" }],
      // 3 has no positions yet, so he can't start anywhere.
      bench: [3],
    });
  });

  it("a bench player who plays an empty slot takes it before anyone ahead of him fills one out of position", () => {
    const draft = { starters: [], bench: [5, 2] };
    expect(reshaped(draft, [cell("defence", "left"), cell("midfield", "centre")], PLAYS, NO_STARS)).toEqual({
      starters: [{ playerCode: 2, area: "defence", lane: "left" }, { playerCode: 5, area: "midfield", lane: "centre" }],
      bench: [],
    });
  });

  it("only a keeper goes in goal, and a keeper only in goal", () => {
    const outfield = { starters: [{ playerCode: 2, area: "defence", lane: "left" } as const], bench: [1, 5] };
    expect(reshaped(outfield, [cell("defence", "left"), cell("defence", "right")], PLAYS, NO_STARS)).toEqual({
      starters: [{ playerCode: 2, area: "defence", lane: "left" }, { playerCode: 5, area: "defence", lane: "right" }],
      bench: [1],
    });
    const noKeeper = { starters: [{ playerCode: 2, area: "defence", lane: "left" } as const], bench: [5] };
    expect(reshaped(noKeeper, [KEEPER, cell("defence", "left")], PLAYS, NO_STARS)).toEqual({
      starters: [{ playerCode: 2, area: "defence", lane: "left" }],
      bench: [5],
    });
  });
});
