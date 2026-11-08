// Sweeper and libero on the Tactics tab (spec/05 The pitch and Roles; #989; Craig, 4 Nov 2026): a
// preset that leaves fewer than three centre-backs drops a starter on either to his best-star role
// in his new slot, and a back three keeps him on it.

import { describe, expect, it } from "vitest";
import { DEFAULT_PRESETS } from "../../../../convex/lineup/presets";
import { positionOfSlot } from "../../../../convex/lineup/pitch";
import { reshaped, type RatingsOf } from "../../../../src/myTeam/tactics/lineupEdits";

const cellsOf = (name: string) => DEFAULT_PRESETS.find((preset) => preset.name === name)!.cells;
const PLAYS = { positionsOf: (playerCode: number) => (playerCode === 1 ? (["GK"] as const) : (["CB"] as const)) };
const LIBERO_BEST: RatingsOf = () => [
  { area: "defence", role: "libero", stars: 5 },
  { area: "defence", role: "ballPlayingDefender", stars: 4 },
];

/** A keeper, and a back three with its middle man on libero. */
const BACK_THREE = {
  starters: [
    { playerCode: 1, area: "goalkeeper", lane: "centre" },
    { playerCode: 2, area: "defence", lane: "leftCentre" },
    { playerCode: 3, area: "defence", lane: "centre", role: "libero" },
    { playerCode: 4, area: "defence", lane: "rightCentre" },
  ] as const,
  bench: [],
};

describe("a libero when the shape changes", () => {
  it("keeps it in another back three", () => {
    const after = reshaped(BACK_THREE, cellsOf("5-3-2"), PLAYS, LIBERO_BEST);
    expect(after.starters.find((starter) => starter.playerCode === 3)?.role).toBe("libero");
  });

  it("starts on his best centre-back role in a back four", () => {
    const after = reshaped(BACK_THREE, cellsOf("4-4-2"), PLAYS, LIBERO_BEST);
    const moved = after.starters.find((starter) => starter.playerCode === 3)!;
    expect(positionOfSlot(moved)).toBe("CB");
    expect(moved.role).toBe("ballPlayingDefender");
  });
});
