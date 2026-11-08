import { describe, expect, test } from "vitest";
import {
  GAMEWEEKS,
  isGameweekScored,
  isGameweekUsed,
  lastPlayedGameweek,
  noSuchGameweek,
  scoredGameweeksOf,
  SEASON_GAMEWEEKS,
  unusedAfter,
  usedGameweeksOf,
} from "../../../convex/gameweeks/usedGameweeks";

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
    expect(() => isGameweekUsed({}, gameweek)).toThrow(noSuchGameweek(gameweek));
  });
});

describe("usedGameweeksOf", () => {
  test("is every gameweek of the season, in order, but those the league unticked", () => {
    expect(usedGameweeksOf({})).toHaveLength(GAMEWEEKS);
    const withBreak = usedGameweeksOf({ unusedGameweeks: [17, 18] });
    expect(withBreak.slice(14, 18)).toEqual([15, 16, 19, 20]);
    expect(withBreak).toHaveLength(GAMEWEEKS - 2);
  });
});

describe("lastPlayedGameweek", () => {
  test("is the season's last for a league that plays it, and the last it plays for one that ends early (spec/13)", () => {
    expect(lastPlayedGameweek({})).toBe(GAMEWEEKS);
    expect(lastPlayedGameweek({ unusedGameweeks: [17, GAMEWEEKS - 1, GAMEWEEKS] })).toBe(GAMEWEEKS - 2);
  });

  test("is before the season's first for a league that plays none", () => {
    expect(lastPlayedGameweek({ unusedGameweeks: [...SEASON_GAMEWEEKS] })).toBe(0);
  });
});

describe("isGameweekScored and scoredGameweeksOf", () => {
  test("a league with no scoring start scores every gameweek it plays", () => {
    expect(scoredGameweeksOf({ unusedGameweeks: [17] })).toEqual(usedGameweeksOf({ unusedGameweeks: [17] }));
  });

  test("a league scores none before its scoring start, nor one it unticked after", () => {
    const league = { unusedGameweeks: [9], scoringStart: 8 };
    expect([7, 8, 9, 10].map((gameweek) => isGameweekScored(league, gameweek))).toEqual([false, true, false, true]);
    expect(scoredGameweeksOf(league).slice(0, 3)).toEqual([8, 10, 11]);
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
