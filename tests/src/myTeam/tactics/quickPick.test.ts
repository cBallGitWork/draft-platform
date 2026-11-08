// Quick Pick (spec/05, Moving players; #849): the current shape filled with the best eleven by
// stars, by Craig's answers of 6 Nov 2026 on #849.

import { describe, expect, it } from "vitest";
import { cellKey, type Cell } from "../../../../convex/lineup/pitch";
import type { Position } from "../../../../convex/positions/positionTables";
import { NO_DATA, UNSURE, type Stars } from "../../../../convex/stars/starsShape";
import { quickPick, type PickedFrom } from "../../../../src/myTeam/tactics/quickPick";
import type { EditedLineup } from "../../../../src/myTeam/tactics/lineupEdits";

const GOAL: Cell = { area: "goalkeeper", lane: "centre" };
const BACK: Cell = { area: "defence", lane: "leftCentre" };
const UP_FRONT: Cell = { area: "attack", lane: "centre" };
const SHAPE = [GOAL, BACK, UP_FRONT];

/** A squad player rated on one role per position he plays: a keeper as a shot stopper, a centre-back
 *  as a stopper, a striker as a poacher. */
function player(playerCode: number, positions: Position[], stars: Partial<Record<Position, Stars>>, availability: PickedFrom["availability"] = "available"): PickedFrom {
  const rated = { GK: ["goalkeeper", "shotStopper"], CB: ["defence", "stopper"], ST: ["attack", "poacher"] } as const;
  return {
    playerCode,
    positions,
    availability,
    unheld: false,
    stars: Object.entries(stars).map(([position, value]) => {
      const [area, role] = rated[position as keyof typeof rated];
      return { area, role, stars: value };
    }),
  };
}

const KEEPER = player(1, ["GK"], { GK: 3 });
const lineupOf = (starting: readonly [PickedFrom, Cell][], bench: readonly PickedFrom[]): EditedLineup => ({
  starters: starting.map(([{ playerCode }, cell]) => ({ playerCode, ...cell })),
  bench: bench.map(({ playerCode }) => playerCode),
});
/** Who stands in each cell, by its key. */
const standing = (lineup: EditedLineup) => Object.fromEntries(lineup.starters.map(({ playerCode, area, lane }) => [cellKey({ area, lane }), playerCode]));

describe("Quick Pick", () => {
  it("fills each slot with the highest-starred player who can stand there, the shape's cells kept", () => {
    const starter = player(2, ["CB"], { CB: 3 });
    const better = player(3, ["CB"], { CB: 4.5 });
    const striker = player(4, ["ST"], { ST: 2 });
    const draft = lineupOf([[KEEPER, GOAL], [starter, BACK], [striker, UP_FRONT]], [better]);
    const picked = quickPick(draft, SHAPE, [KEEPER, starter, better, striker]);
    expect(standing(picked)).toEqual({ [cellKey(GOAL)]: 1, [cellKey(BACK)]: 3, [cellKey(UP_FRONT)]: 4 });
  });

  it("never leaves a slot empty the squad can fill, so the area limits the shape keeps still hold", () => {
    // He has the most stars at the back, but only he can play up front.
    const both = player(2, ["CB", "ST"], { CB: 5, ST: 2 });
    const back = player(3, ["CB"], { CB: 4 });
    const draft = lineupOf([[KEEPER, GOAL], [back, BACK]], [both]);
    expect(standing(quickPick(draft, SHAPE, [KEEPER, both, back]))).toEqual({ [cellKey(GOAL)]: 1, [cellKey(BACK)]: 3, [cellKey(UP_FRONT)]: 2 });
  });

  it("fills an empty slot of the shape picked, and leaves one empty that nobody can stand in", () => {
    const back = player(2, ["CB"], { CB: 3 });
    const draft = lineupOf([[KEEPER, GOAL]], [back]);
    expect(standing(quickPick(draft, SHAPE, [KEEPER, back]))).toEqual({ [cellKey(GOAL)]: 1, [cellKey(BACK)]: 2 });
  });

  it("never picks a player who is out while a fit one can stand there; a doubtful one is picked on his stars", () => {
    const out = player(2, ["CB"], { CB: 5 }, "out");
    const fit = player(3, ["CB"], { CB: 1 });
    const doubtful = player(4, ["ST"], { ST: 4 }, "doubtful");
    const striker = player(5, ["ST"], { ST: 3 });
    const draft = lineupOf([[KEEPER, GOAL], [out, BACK], [striker, UP_FRONT]], [fit, doubtful]);
    expect(standing(quickPick(draft, SHAPE, [KEEPER, out, fit, doubtful, striker]))).toEqual({ [cellKey(GOAL)]: 1, [cellKey(BACK)]: 3, [cellKey(UP_FRONT)]: 4 });
  });

  it("picks one who is out where nobody fit can stand, as one the football sync doesn't hold", () => {
    const out = player(2, ["CB"], { CB: 2 }, "out");
    const unheld = { ...player(3, ["ST"], {}), unheld: true, availability: null };
    const draft = lineupOf([[KEEPER, GOAL]], [out, unheld]);
    expect(standing(quickPick(draft, SHAPE, [KEEPER, out, unheld]))).toEqual({ [cellKey(GOAL)]: 1, [cellKey(BACK)]: 2, [cellKey(UP_FRONT)]: 3 });
  });

  it('ranks "?" and "—" below any starred player', () => {
    const unsure = player(2, ["CB"], { CB: UNSURE });
    const newSigning = player(3, ["CB"], { CB: NO_DATA });
    const halfStar = player(4, ["CB"], { CB: 0.5 });
    const draft = lineupOf([[KEEPER, GOAL], [unsure, BACK]], [newSigning, halfStar]);
    expect(standing(quickPick(draft, [GOAL, BACK], [KEEPER, unsure, newSigning, halfStar]))[cellKey(BACK)]).toBe(4);
  });

  it("on a tie keeps whoever is already starting, then goes by bench order", () => {
    const starter = player(2, ["CB"], { CB: 4 });
    const first = player(3, ["CB"], { CB: 4 });
    const second = player(4, ["CB"], { CB: 4 });
    const kept = lineupOf([[KEEPER, GOAL], [starter, BACK]], [second, first]);
    expect(standing(quickPick(kept, [GOAL, BACK], [KEEPER, starter, first, second]))[cellKey(BACK)]).toBe(2);
    const empty = lineupOf([[KEEPER, GOAL]], [second, first]);
    expect(standing(quickPick(empty, [GOAL, BACK], [KEEPER, first, second]))[cellKey(BACK)]).toBe(4);
  });

  it("puts each player picked on his best-star role there, keeps a kept starter's own, and sends a starter left out to the front of the bench", () => {
    const keeper = { ...player(1, ["GK"], { GK: 2 }), stars: [{ area: "goalkeeper" as const, role: "sweeperKeeper", stars: 5 }] };
    const starter = player(2, ["CB"], { CB: 2 });
    const better = player(3, ["CB"], { CB: 4 });
    const draft: EditedLineup = { starters: [{ playerCode: 9, ...GOAL }, { playerCode: 2, ...BACK, role: "stopper" }], bench: [7, 3, 1], classic: "Keegan's Newcastle" };
    const benchedKeeper = player(9, ["GK"], { GK: 1 });
    const picked = quickPick(draft, [GOAL, BACK], [benchedKeeper, starter, better, keeper, player(7, ["ST"], {})]);
    expect(picked.starters).toContainEqual({ playerCode: 1, ...GOAL, role: "sweeperKeeper" });
    expect(picked.bench).toEqual([9, 2, 7]);
    expect(picked.classic).toBe("Keegan's Newcastle");
    // A starter who stays where he is keeps the role he was given.
    const kept = quickPick({ starters: [{ playerCode: 1, ...GOAL, role: "shotStopper" }], bench: [] }, [GOAL], [keeper]);
    expect(kept.starters).toEqual([{ playerCode: 1, ...GOAL, role: "shotStopper" }]);
  });
});
