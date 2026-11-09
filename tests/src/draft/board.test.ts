import { describe, expect, it } from "vitest";
import { pickAt, pickInRoundAt, pickInRoundOf, pickMakers, picksOf, roundOf, roundsShown } from "../../../src/draft/board";

// Where each pick sits on the draft board (spec/04, The picks and The draft room; #1098).

describe("the rounds the board shows", () => {
  it("are six, the round on the clock fourth, as the approved picture has round 4 of 20", () => {
    expect(roundsShown(20, 4, false)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(roundsShown(20, 10, false)).toEqual([7, 8, 9, 10, 11, 12]);
  });

  it("stop at the last round, and are every round when fewer than six", () => {
    expect(roundsShown(20, 19, false)).toEqual([15, 16, 17, 18, 19, 20]);
    expect(roundsShown(3, 2, false)).toEqual([1, 2, 3]);
  });

  it("are every round on the whole board", () => {
    expect(roundsShown(8, 4, true)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("a pick's place", () => {
  it("runs the snake: left to right in odd rounds, right to left in even", () => {
    expect([0, 1, 2].map((column) => pickAt(1, column, 3))).toEqual([1, 2, 3]);
    expect([0, 1, 2].map((column) => pickAt(2, column, 3))).toEqual([6, 5, 4]);
    expect([0, 1, 2].map((column) => pickInRoundAt(2, column, 3))).toEqual([3, 2, 1]);
  });

  it("gives each pick number its round and its pick in the round", () => {
    expect([1, 3, 4, 6, 7].map((pick) => [roundOf(pick, 3), pickInRoundOf(pick, 3)])).toEqual([
      [1, 1],
      [1, 3],
      [2, 1],
      [2, 3],
      [3, 1],
    ]);
  });

  it("lists a team's picks over the draft", () => {
    expect(picksOf("B", ["A", "B", "C"], 3, [])).toEqual([2, 5, 8]);
  });

  it("counts a pick a team holds after a trade, and leaves out the one it traded away (#1096)", () => {
    // B's round-2 pick for C's round-3 pick: B makes C's round-3 turn, C makes B's round-2 turn.
    const traded = [
      { round: 2, teamId: "B", ownerId: "C" },
      { round: 3, teamId: "C", ownerId: "B" },
    ];
    expect(pickMakers(["A", "B", "C"], 3, traded)).toEqual(["A", "B", "C", "C", "C", "A", "A", "B", "B"]);
    expect(picksOf("B", ["A", "B", "C"], 3, traded)).toEqual([2, 8, 9]);
  });
});
