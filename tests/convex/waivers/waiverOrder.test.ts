import { describe, expect, test } from "vitest";
import { startingFrom, winnersNow, withWinnersLast, wonBy } from "../../../convex/waivers/waiverOrder";

// The waiver order's rules (#1198, spec/08), pure.

describe("the waiver order", () => {
  test("each winner goes to the bottom, the latest last", () => {
    const winners = wonBy(wonBy(wonBy([], "A"), "C"), "A");
    expect(winners).toEqual(["C", "A"]);
    expect(withWinnersLast(["A", "B", "C", "D"], winners)).toEqual(["B", "D", "C", "A"]);
  });

  test("a winner no longer in the league is passed over", () => {
    expect(withWinnersLast(["A", "B"], ["Gone", "A"])).toEqual(["B", "A"]);
  });

  test("under reverse table order the winners go back up once a later gameweek has ended", () => {
    const held = { winners: ["A"], gameweek: 5 };
    expect(winnersNow("reverseStandings", held, 5)).toEqual(["A"]);
    expect(winnersNow("reverseStandings", held, 6)).toEqual([]);
  });

  test("under rotating they never do", () => {
    expect(winnersNow("rotating", { winners: ["A"], gameweek: 5 }, 9)).toEqual(["A"]);
  });

  test("before any run there are none", () => {
    expect(winnersNow("rotating", null, 5)).toEqual([]);
  });
});

describe("the order a switch of type left", () => {
  const start = { teams: ["C", "A", "Gone"], gameweek: 5 };

  test("under rotating it stands for good", () => {
    expect(startingFrom("rotating", start, 9, ["A", "B", "C"])).toEqual(["C", "A", "B"]);
  });

  test("under reverse table order it stands until a later gameweek ends", () => {
    expect(startingFrom("reverseStandings", start, 5, ["A", "B", "C"])).toEqual(["C", "A", "B"]);
    expect(startingFrom("reverseStandings", start, 6, ["A", "B", "C"])).toBeNull();
  });

  test("with no switch there is none", () => {
    expect(startingFrom("rotating", null, 5, ["A", "B"])).toBeNull();
  });
});
