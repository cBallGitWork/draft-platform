import { expect, test } from "vitest";
import { firstLineup } from "../../../convex/lineup/firstLineup";
import type { Position } from "../../../convex/positions/positionTables";

// A team's first lineup (spec/05, #637): "a 4-4-2 filled in draft selection order, each slot by
// the first player picked who plays there, and the rest on the bench in that order".

/** Players by code, each with his positions, in the order they were picked. */
const picked = (...players: [number, Position[]][]) => ({
  order: players.map(([code]) => code),
  positions: new Map(players),
});

const KEEPER = { area: "goalkeeper", lane: "centre" } as const;
const BACK_FOUR = (["left", "leftCentre", "rightCentre", "right"] as const).map((lane) => ({ area: "defence", lane }) as const);
const FLAT_FOUR = (["left", "leftCentre", "rightCentre", "right"] as const).map((lane) => ({ area: "midfield", lane }) as const);
const STRIKE_PAIR = (["leftCentre", "rightCentre"] as const).map((lane) => ({ area: "attack", lane }) as const);

test("a full squad fills the 4-4-2 back to front in the order it was picked, the rest on the bench in that order", () => {
  const { order, positions } = picked(
    [1, ["ST"]], [2, ["GK"]], [3, ["CB"]], [4, ["FB"]], [5, ["CM"]], [6, ["CB"]], [7, ["WM"]], [8, ["ST"]],
    [9, ["GK"]], [10, ["CB"]], [11, ["CM"]], [12, ["CM"]], [13, ["FB"]], [14, ["ST"]], [15, ["CM"]],
  );
  expect(firstLineup(order, positions)).toEqual({
    starters: [
      { playerCode: 2, ...KEEPER },
      ...[3, 4, 6, 10].map((playerCode, index) => ({ playerCode, ...BACK_FOUR[index] })),
      ...[5, 7, 11, 12].map((playerCode, index) => ({ playerCode, ...FLAT_FOUR[index] })),
      ...[1, 8].map((playerCode, index) => ({ playerCode, ...STRIKE_PAIR[index] })),
    ],
    bench: [9, 13, 14, 15],
  });
});

test("a player who plays two areas fills the first slot back to front he plays: a wing back the back four", () => {
  const { order, positions } = picked([1, ["WB"]], [2, ["WM"]]);
  expect(firstLineup(order, positions)).toEqual({
    starters: [{ playerCode: 1, ...BACK_FOUR[0] }, { playerCode: 2, ...FLAT_FOUR[0] }],
    bench: [],
  });
});

test("a slot nobody can play stays empty, and only a keeper goes in goal", () => {
  const { order, positions } = picked([1, ["CB"]], [2, ["CB"]]);
  expect(firstLineup(order, positions)).toEqual({ starters: [1, 2].map((playerCode, index) => ({ playerCode, ...BACK_FOUR[index] })), bench: [] });
});

test("a player with no positions yet, or none known, sits on the bench", () => {
  expect(firstLineup([1, 2], new Map([[1, []]]))).toEqual({ starters: [], bench: [1, 2] });
});

test("an empty squad has an empty lineup", () => {
  expect(firstLineup([], new Map())).toEqual({ starters: [], bench: [] });
});
