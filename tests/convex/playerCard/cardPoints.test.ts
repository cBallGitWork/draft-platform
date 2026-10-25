import { expect, test } from "vitest";
import { cardPoints } from "../../../convex/playerCard/cardPoints";
import { centreOf, EXAMPLE_SET } from "../../support/convex/scoring.example";

// A match on a player's card (#381, spec/12 The player card): his slot's points when he stood in a
// lineup, else what he would score at his best position, labelled so. Figures from EXAMPLE_SET.

test("a player in no lineup is priced at the slot his positions allow that scores the most", () => {
  // Ten defensive actions pay 2 in defensive midfield and nothing in midfield, where it takes 12.
  const points = cardPoints({ minutes: 90, defensive_contribution: 10 }, EXAMPLE_SET, ["CDM", "CM"], null);

  expect(points).toMatchObject({ scoredAs: "bestPosition", position: "CDM", total: 4 });
});

test("a player in a lineup is priced at his slot, even where another would have paid more", () => {
  const points = cardPoints({ minutes: 90, defensive_contribution: 10 }, EXAMPLE_SET, ["CDM", "CM"], centreOf("midfield"));

  expect(points).toMatchObject({ scoredAs: "slot", position: "CM", total: 2 });
});

test("a tie between slots names his own position, not another his area allows", () => {
  // A goal and an assist pay the same anywhere in attacking midfield, at W or at CAM.
  const record = { minutes: 90, goals_scored: 1, assists: 1 };

  expect(cardPoints(record, EXAMPLE_SET, ["CAM"], null)).toMatchObject({ position: "CAM", total: 11 });
  expect(cardPoints(record, EXAMPLE_SET, ["W"], null)).toMatchObject({ position: "W", total: 11 });
});

test("a player with two areas is priced in the one that pays more for his match", () => {
  // A goal and an assist: 5 + 4 + 2 in attacking midfield, 4 + 3 + 2 up front.
  expect(cardPoints({ minutes: 90, goals_scored: 1, assists: 1 }, EXAMPLE_SET, ["W", "ST"], null)).toMatchObject({ position: "W", total: 11 });
  // A striker alone has only the front: 4 × 2 + 2 for two goals.
  expect(cardPoints({ minutes: 90, goals_scored: 2 }, EXAMPLE_SET, ["ST"], null).total).toBe(10);
});

test("each category's points come with the total, in the set's order", () => {
  const points = cardPoints({ minutes: 90, goals_scored: 1, goals_conceded: 4 }, EXAMPLE_SET, ["CB"], null);

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
  const points = cardPoints(null, EXAMPLE_SET, ["CB"], null);

  expect(points).toMatchObject({ scoredAs: "bestPosition", position: null, total: null });
  expect(points.categories.every((category) => category.points === null)).toBe(true);
});

test("a player with no position yet has no best position to be priced at", () => {
  expect(cardPoints({ minutes: 90, goals_scored: 1 }, EXAMPLE_SET, [], null)).toMatchObject({ position: null, total: null });
});
