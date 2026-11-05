import { describe, expect, test } from "vitest";
import { pickOnTheClock, snakeOrder } from "../../../convex/draft/snakeOrder";

// The order of a draft's picks (spec/04, The picks; #1088): snake only, each round the other way
// from the one before.

describe("the snake order", () => {
  test("2 teams: each round turns at the end of the last", () => {
    expect(snakeOrder(["A", "B"], 4)).toEqual(["A", "B", "B", "A", "A", "B", "B", "A"]);
  });

  test("3 teams: the team last in a round is first in the next", () => {
    expect(snakeOrder(["A", "B", "C"], 3)).toEqual(["A", "B", "C", "C", "B", "A", "A", "B", "C"]);
  });

  test("10 teams over 15 rounds: 150 picks, each team picking once a round, every other round reversed", () => {
    const teams = Array.from({ length: 10 }, (_, index) => `T${index + 1}`);
    const order = snakeOrder(teams, 15);
    expect(order).toHaveLength(150);
    for (let round = 0; round < 15; round++) {
      const picks = order.slice(round * 10, round * 10 + 10);
      expect(picks).toEqual(round % 2 === 0 ? teams : [...teams].reverse());
    }
    expect(order.slice(9, 11)).toEqual(["T10", "T10"]);
  });

  test("fewer teams than the league's maximum: only the teams that exist pick", () => {
    // A league for 10 that drafts with the 4 teams it has (spec/04, Starting it).
    const order = snakeOrder(["A", "B", "C", "D"], 2);
    expect(order).toEqual(["A", "B", "C", "D", "D", "C", "B", "A"]);
  });

  test("one round is the draft order once; no rounds, no picks", () => {
    expect(snakeOrder(["A", "B", "C"], 1)).toEqual(["A", "B", "C"]);
    expect(snakeOrder(["A", "B", "C"], 0)).toEqual([]);
  });
});

describe("the pick on the clock (#1089)", () => {
  test("is the first team's first pick before any is made", () => {
    expect(pickOnTheClock(["A", "B", "C"], 2, 0)).toEqual({ pick: 1, round: 1, team: "A" });
  });

  test("turns at the end of a round: the last team picks again, in round 2", () => {
    expect(pickOnTheClock(["A", "B", "C"], 2, 3)).toEqual({ pick: 4, round: 2, team: "C" });
    expect(pickOnTheClock(["A", "B", "C"], 2, 5)).toEqual({ pick: 6, round: 2, team: "A" });
  });

  test("is none once every pick is made", () => {
    expect(pickOnTheClock(["A", "B", "C"], 2, 6)).toBeNull();
  });
});
