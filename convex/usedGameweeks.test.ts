import { describe, expect, test } from "vitest";
import { GAMEWEEKS, isGameweekUsed, unusedAfter } from "./usedGameweeks";

// The helper scoring (#29) and the fixtures (#33) read: whether a league plays a gameweek (#74).

describe("isGameweekUsed", () => {
  test("a league that unticked none plays every gameweek", () => {
    for (let gameweek = 1; gameweek <= GAMEWEEKS; gameweek += 1) expect(isGameweekUsed({}, gameweek)).toBe(true);
  });

  test("a league plays every gameweek but those it unticked", () => {
    const league = { unusedGameweeks: [17, 18] };
    expect([16, 17, 18, 19].map((gameweek) => isGameweekUsed(league, gameweek))).toEqual([true, false, false, true]);
  });

  test.each([0, GAMEWEEKS + 1, 2.5])("asking of gameweek %s, which the season doesn't have, throws", (gameweek) => {
    expect(() => isGameweekUsed({}, gameweek)).toThrow(`There's no gameweek ${gameweek}`);
  });
});

describe("unusedAfter", () => {
  test("unticking adds the gameweek in order, once", () => {
    expect(unusedAfter({ unusedGameweeks: [17, 19] }, 18, false)).toEqual([17, 18, 19]);
    expect(unusedAfter({ unusedGameweeks: [17] }, 17, false)).toEqual([17]);
  });

  test("ticking takes it out", () => {
    expect(unusedAfter({ unusedGameweeks: [17, 18] }, 17, true)).toEqual([18]);
    expect(unusedAfter({}, 17, true)).toEqual([]);
  });
});
