import { describe, expect, test } from "vitest";
import { isGameweekScored, isGameweekUsed, lastPlayedGameweek, noSuchGameweek, scoredGameweeksOf, seasonGameweeks, unusedAfter, usedGameweeksOf } from "../../../convex/gameweeks/usedGameweeks";
import { PL_GAMEWEEKS } from "../../support/convex/footballRows.harness";

// The helper scoring (#29) and the fixtures (#33) read: whether a league plays a gameweek (#74).

/** A Bundesliga season's gameweeks: a season with fewer than the Premier League's (#1618). */
const BUNDESLIGA_GAMEWEEKS = 34;

describe("isGameweekUsed", () => {
  test("a league that unticked none plays every gameweek", () => {
    for (let gameweek = 1; gameweek <= PL_GAMEWEEKS; gameweek += 1) expect(isGameweekUsed({}, gameweek, PL_GAMEWEEKS)).toBe(true);
  });

  test("a league plays every gameweek but those it unticked", () => {
    const league = { unusedGameweeks: [17, 18] };
    expect([16, 17, 18, 19].map((gameweek) => isGameweekUsed(league, gameweek, PL_GAMEWEEKS))).toEqual([true, false, false, true]);
  });

  test.each([0, PL_GAMEWEEKS + 1, 2.5])("asking of gameweek %s, which the season doesn't have, throws", (gameweek) => {
    expect(() => isGameweekUsed({}, gameweek, PL_GAMEWEEKS)).toThrow(noSuchGameweek(gameweek, PL_GAMEWEEKS));
  });

  test("a season's gameweeks are however many it has: a 34-gameweek season has no gameweek 35 (#1618)", () => {
    expect(isGameweekUsed({}, BUNDESLIGA_GAMEWEEKS, BUNDESLIGA_GAMEWEEKS)).toBe(true);
    expect(() => isGameweekUsed({}, BUNDESLIGA_GAMEWEEKS + 1, BUNDESLIGA_GAMEWEEKS)).toThrow(
      "There's no gameweek 35: this season has gameweeks 1 to 34.",
    );
  });

  test("a season with no gameweeks held yet has none, and says they haven't arrived, never '1 to 0' (#1618)", () => {
    expect(() => isGameweekUsed({}, 1, 0)).toThrow("There's no gameweek 1 yet: this season's gameweeks haven't arrived from the feed.");
  });
});

describe("usedGameweeksOf", () => {
  test("is every gameweek of the season, in order, but those the league unticked", () => {
    expect(usedGameweeksOf({}, PL_GAMEWEEKS)).toHaveLength(PL_GAMEWEEKS);
    const withBreak = usedGameweeksOf({ unusedGameweeks: [17, 18] }, PL_GAMEWEEKS);
    expect(withBreak.slice(14, 18)).toEqual([15, 16, 19, 20]);
    expect(withBreak).toHaveLength(PL_GAMEWEEKS - 2);
  });

  test("is as long as the season, whatever its count", () => {
    expect(usedGameweeksOf({}, BUNDESLIGA_GAMEWEEKS)).toEqual(seasonGameweeks(BUNDESLIGA_GAMEWEEKS));
    expect(usedGameweeksOf({}, 0)).toEqual([]);
  });
});

describe("lastPlayedGameweek", () => {
  test("is the season's last for a league that plays it, and the last it plays for one that ends early (spec/13)", () => {
    expect(lastPlayedGameweek({}, PL_GAMEWEEKS)).toBe(PL_GAMEWEEKS);
    expect(lastPlayedGameweek({}, BUNDESLIGA_GAMEWEEKS)).toBe(BUNDESLIGA_GAMEWEEKS);
    expect(lastPlayedGameweek({ unusedGameweeks: [17, PL_GAMEWEEKS - 1, PL_GAMEWEEKS] }, PL_GAMEWEEKS)).toBe(PL_GAMEWEEKS - 2);
  });

  test("is before the season's first for a league that plays none", () => {
    expect(lastPlayedGameweek({ unusedGameweeks: [...seasonGameweeks(PL_GAMEWEEKS)] }, PL_GAMEWEEKS)).toBe(0);
  });
});

describe("isGameweekScored and scoredGameweeksOf", () => {
  test("a league with no scoring start scores every gameweek it plays", () => {
    expect(scoredGameweeksOf({ unusedGameweeks: [17] }, PL_GAMEWEEKS)).toEqual(usedGameweeksOf({ unusedGameweeks: [17] }, PL_GAMEWEEKS));
  });

  test("a league scores none before its scoring start, nor one it unticked after", () => {
    const league = { unusedGameweeks: [9], scoringStart: 8 };
    expect([7, 8, 9, 10].map((gameweek) => isGameweekScored(league, gameweek, PL_GAMEWEEKS))).toEqual([false, true, false, true]);
    expect(scoredGameweeksOf(league, PL_GAMEWEEKS).slice(0, 3)).toEqual([8, 10, 11]);
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
