import { expect, test } from "vitest";
import { ALL_CELLS, cellKey, positionOfSlot, SLOT_POSITIONS } from "../../../convex/lineup/pitch";
import { basePoints, cardOpensAt, cardPoints, cardPositions, cellAt, pointsAt } from "../../../convex/playerCard/cardPoints";
import { scoreMatch } from "../../../convex/scoring/scoring";
import { EXAMPLE_SET, GOAL_AND_ASSIST } from "../../support/convex/scoring.example";

// A player's match priced with no lineup (#381): at his best position, as the Squad tab prices a
// match no lineup counted, and at a chosen position, as his card shows his base points (spec/12).
// Figures from EXAMPLE_SET.

test("a player in no lineup is priced at the slot his positions allow that scores the most", () => {
  // Ten defensive actions earn 2 in defensive midfield and nothing in midfield, where it takes 12.
  const points = cardPoints({ minutes: 90, defensive_contribution: 10 }, EXAMPLE_SET, ["CDM", "CM"]);

  expect(points).toMatchObject({ scoredAs: "bestPosition", position: "CDM", total: 4 });
});

test("a tie between slots names his own position, not another his area allows", () => {
  // A goal and an assist earn the same anywhere in attacking midfield, at W or at CAM.
  expect(cardPoints(GOAL_AND_ASSIST, EXAMPLE_SET, ["CAM"])).toMatchObject({ position: "CAM", total: 11 });
  expect(cardPoints(GOAL_AND_ASSIST, EXAMPLE_SET, ["W"])).toMatchObject({ position: "W", total: 11 });
});

test("a player with two areas is priced in the one that scores more for his match", () => {
  // A goal and an assist: 5 + 4 + 2 in attacking midfield, 4 + 3 + 2 up front.
  expect(cardPoints(GOAL_AND_ASSIST, EXAMPLE_SET, ["W", "ST"])).toMatchObject({ position: "W", total: 11 });
});

test("each category's points come with the total, in the set's order", () => {
  const points = cardPoints({ minutes: 90, goals_scored: 1, goals_conceded: 4 }, EXAMPLE_SET, ["CB"]);

  expect(points.position).toBe("CB");
  expect(points.categories.map((category) => [category.stat, category.points])).toEqual([
    ["goals_scored", 6],
    ["assists", 0],
    ["minutes", 2],
    ["saves", 0],
    ["goals_conceded", -2],
    ["defensive_contribution", 0],
    ["yellow_cards", 0],
  ]);
  expect(points.total).toBe(6);
});

test("while his record hasn't arrived, every figure is null and no best position is named", () => {
  const points = cardPoints(null, EXAMPLE_SET, ["CB"]);

  expect(points).toMatchObject({ scoredAs: "bestPosition", position: null, total: null });
  expect(points.categories.every((category) => category.points === null)).toBe(true);
});

test("a player with no position yet has no best position to be priced at", () => {
  expect(cardPoints({ minutes: 90, goals_scored: 1 }, EXAMPLE_SET, [])).toMatchObject({ position: null, total: null });
});

// His base points at a chosen position, the card's switch (spec/12; Craig, 31 Oct 2026).

test("the card prices the positions he has that a slot can be, back to front, leaving out SS, which no slot prices yet", () => {
  expect(cardPositions(["ST", "SS", "W"])).toEqual(["W", "ST"]);
  expect(cardPositions(["CM", "CB", "GK"])).toEqual(["GK", "CB", "CM"]);
  expect(cardPositions(["SS"])).toEqual([]);
  expect(cardPositions([])).toEqual([]);
});

test("each position is priced in the first cell of its slot, back to front, then left to right", () => {
  expect(cellAt("CB")).toEqual({ area: "defence", lane: "leftCentre" });
  expect(cellAt("FB")).toEqual({ area: "defence", lane: "left" });
  expect(cellAt("WB")).toEqual({ area: "defensiveMidfield", lane: "left" });
  expect(cellAt("ST")).toEqual({ area: "attack", lane: "left" });
  for (const position of SLOT_POSITIONS) expect(positionOfSlot(cellAt(position))).toBe(position);
});

test("every cell of a position's slot would price him the same as the one chosen", () => {
  const record = { minutes: 90, goals_scored: 1, assists: 1, defensive_contribution: 12, goals_conceded: 2 };
  for (const cell of ALL_CELLS) {
    expect(scoreMatch(record, EXAMPLE_SET, cell), cellKey(cell)).toEqual(scoreMatch(record, EXAMPLE_SET, cellAt(positionOfSlot(cell))));
  }
});

test("his base points at a position are that slot's, though another of his would score more, with no role", () => {
  expect(pointsAt(GOAL_AND_ASSIST, EXAMPLE_SET, "W")).toMatchObject({ position: "W", total: 11 });
  expect(pointsAt(GOAL_AND_ASSIST, EXAMPLE_SET, "ST")).toMatchObject({ position: "ST", total: 9 });
  expect(pointsAt(GOAL_AND_ASSIST, EXAMPLE_SET, "ST")).not.toHaveProperty("role");
  expect(pointsAt(null, EXAMPLE_SET, "W")).toMatchObject({ position: "W", total: null });
});

test("his base points come at each of his card's positions in its order, the first where the card and the match page open", () => {
  expect(basePoints(GOAL_AND_ASSIST, EXAMPLE_SET, ["ST", "W"]).map(({ position, total }) => [position, total])).toEqual([
    ["W", 11],
    ["ST", 9],
  ]);
  // A centre-back first, though his ten defensive actions earn more in defensive midfield.
  expect(basePoints({ minutes: 90, defensive_contribution: 10 }, EXAMPLE_SET, ["CDM", "CB"])[0]).toMatchObject({ position: "CB" });
});

test("with no position a slot prices, his base points come once, at his best", () => {
  expect(basePoints(GOAL_AND_ASSIST, EXAMPLE_SET, ["SS"])).toMatchObject([{ position: "W", total: 11 }]);
  expect(basePoints(GOAL_AND_ASSIST, EXAMPLE_SET, [])).toMatchObject([{ position: null, total: null }]);
});

test("the one position his card opens on prices each match as the card's first figure does (#525)", () => {
  const stats = { minutes: 90, defensive_contribution: 10, goals_scored: 1 };
  for (const positions of [["ST", "W"], ["CDM", "CB"], ["SS"], ["SS", "CAM"]] as const) {
    const opensAt = cardOpensAt(positions)!;
    expect(basePoints(stats, EXAMPLE_SET, [opensAt])[0]).toEqual(basePoints(stats, EXAMPLE_SET, positions)[0]);
  }
  expect(cardOpensAt(["CM", "CB"])).toBe("CB");
  expect(cardOpensAt(["SS"])).toBe("SS");
  expect(cardOpensAt([])).toBeNull();
});
