import { describe, expect, test } from "vitest";
import { gamesInAGameweek, LEAGUE_AVERAGE, roundOrder, roundsInARoundRobin, roundsOf, seededRandom } from "../../../convex/table/roundRobin";
import { seasonGameweeks } from "../../../convex/gameweeks/usedGameweeks";
import { PL_GAMEWEEKS } from "../../support/convex/footballRows.harness";
import {
  drawn,
  leftOverIn,
  opponentsIn,
  pairKey,
  SEED,
  spread,
  tally,
  teamsOf,
  WITH_GAPS,
  type DrawOptions,
} from "../../support/convex/roundRobin.harness";

// The round robin (#33, #130; spec/09): as even as can be over a season, one or more games a
// gameweek, never the same opponent twice in a gameweek, each round robin in its own order, drawn
// the same from the same seed, and only over the gameweeks the league plays.

const TEAM_COUNTS = Array.from({ length: 19 }, (_, index) => index + 2); // 2 to 20
const GAMES = [1, 2, 3, 4];
const SEEDS = ["league-a", "league-b", "k57abc123"];
const options = (change: Partial<DrawOptions> = {}): DrawOptions => ({ gamesPerGameweek: 1, seed: SEED, ...change });

describe("as even as can be, the odd team out playing the league's average", () => {
  const cases = TEAM_COUNTS.flatMap((count) => GAMES.flatMap((games) => SEEDS.map((seed) => [count, games, seed] as const)));

  test.each(cases)("%i teams, %i a gameweek, seed %s, over a season with gaps", (count, games, seed) => {
    const teams = teamsOf(count);
    const schedule = drawn(teams, WITH_GAPS, { gamesPerGameweek: games, seed });
    const everyPair = teams.flatMap((one, index) => teams.slice(index + 1).map((other) => pairKey(one, other)));
    const meetings = schedule.flatMap(({ fixtures }) =>
      fixtures.flatMap(({ team, opponent }) => (opponent === LEAGUE_AVERAGE ? [] : [pairKey(team, opponent)])),
    );
    const gamesOf = schedule.flatMap((gameweek) => [...opponentsIn(gameweek)].flatMap(([team, opponents]) => opponents.map(() => team)));
    const leftOver = schedule.flatMap(leftOverIn);

    expect(schedule.map((each) => each.gameweek)).toEqual(WITH_GAPS);
    expect(spread(tally(everyPair, meetings).values())).toBeLessThanOrEqual(1);
    expect(spread(tally(teams, gamesOf).values())).toBeLessThanOrEqual(1);
    if (count % 2 === 1) expect(spread(tally(teams, leftOver).values())).toBeLessThanOrEqual(1);
    else expect(leftOver).toEqual([]);

    const perGameweek = gamesInAGameweek(roundsOf(teams).length, games);
    for (const gameweek of schedule) {
      const opponents = opponentsIn(gameweek);
      expect(gameweek.byes).toEqual([]);
      for (const team of teams) {
        const met = opponents.get(team) ?? [];
        expect(new Set(met).size, `${team} in gameweek ${gameweek.gameweek}`).toBe(met.length);
        expect(met).toHaveLength(perGameweek);
      }
    }
  });
});

test.each(TEAM_COUNTS)("%i teams: one round robin, a game a gameweek, has every pair meet once and each team left over once at most", (count) => {
  const teams = teamsOf(count);
  const rounds = roundsOf(teams).length;
  expect(rounds).toBe(count % 2 === 0 ? count - 1 : count);
  const schedule = drawn(teams, seasonGameweeks(PL_GAMEWEEKS).slice(0, rounds), options());
  const meetings = schedule.flatMap(({ fixtures }) => fixtures.flatMap(({ team, opponent }) => (opponent === LEAGUE_AVERAGE ? [] : [pairKey(team, opponent)])));
  expect(meetings).toHaveLength(new Set(meetings).size);
  expect(meetings).toHaveLength((count * (count - 1)) / 2);
  expect(schedule.flatMap(leftOverIn).toSorted()).toEqual(count % 2 === 0 ? [] : teams.toSorted());
});

describe("games a gameweek", () => {
  test("with an odd number of teams, nobody plays the league's average twice in a gameweek", () => {
    // Each round leaves one team over, a different one each round, and a gameweek never has a
    // round twice: so a team plays the league's average once a gameweek at most.
    for (const count of [3, 5, 7, 9, 19]) {
      for (const games of GAMES) {
        for (const seed of SEEDS) {
          for (const gameweek of drawn(teamsOf(count), WITH_GAPS, { gamesPerGameweek: games, seed })) {
            const leftOver = leftOverIn(gameweek);
            expect(new Set(leftOver).size, `${count} teams, ${games} a gameweek, gameweek ${gameweek.gameweek}`).toBe(leftOver.length);
          }
        }
      }
    }
  });

  test("with two, each team meets two different opponents every gameweek", () => {
    for (const gameweek of drawn(teamsOf(6), seasonGameweeks(PL_GAMEWEEKS), options({ gamesPerGameweek: 2 }))) {
      for (const opponents of opponentsIn(gameweek).values()) expect(new Set(opponents).size).toBe(2);
    }
  });

  test("more than a league has opponents for plays as many as there are: 3 teams meet 2 and the average at most", () => {
    const [first] = drawn(teamsOf(3), [1], options({ gamesPerGameweek: 4 }));
    for (const opponents of opponentsIn(first).values()) expect(opponents).toHaveLength(3);
  });

  test.each([[2, 1], [4, 3], [9, 9], [20, 19]])("%i teams have at most %i a gameweek", (count, most) => {
    expect(gamesInAGameweek(roundsOf(teamsOf(count)).length, 99)).toBe(most);
  });

  test.each(TEAM_COUNTS)("%i teams: the most the rules may ask, as counted without drawing, is one round robin's rounds", (count) => {
    expect(roundsInARoundRobin(count)).toBe(roundsOf(teamsOf(count)).length);
  });

  test.each([[0, 1], [3, 0], [3, 4]])("dealing from %i rounds, %i a gameweek, is a bug, and throws", (rounds, games) => {
    expect(() => roundOrder(rounds, Array.from({ length: 10 }, () => games), "league-a")).toThrow(`Can't deal ${games} of ${rounds} rounds a gameweek`);
  });

  test("a gameweek straddling two round robins never has a round twice", () => {
    // 5 rounds, 3 a gameweek: the second gameweek takes 2 from the first round robin, 1 from the next.
    for (const seed of SEEDS) {
      for (const gameweek of roundOrder(5, Array.from({ length: 10 }, () => 3), seed)) expect(new Set(gameweek).size).toBe(gameweek.length);
    }
  });
});

describe("the order", () => {
  test("each round robin plays every round once", () => {
    const order = roundOrder(7, Array.from({ length: 7 * 4 }, () => 1), "league-a").flat();
    for (let start = 0; start < order.length; start += 7) expect(order.slice(start, start + 7).toSorted()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  test("isn't one order repeated: the round robins come in different orders", () => {
    const order = roundOrder(7, Array.from({ length: 7 * 4 }, () => 1), "league-a").flat();
    const cycles = new Set([0, 7, 14, 21].map((start) => order.slice(start, start + 7).join()));
    expect(cycles.size).toBeGreaterThan(1);
  });

  test("is the same from the same seed, and differs from another", () => {
    const draw = (seed: string) => drawn(teamsOf(8), seasonGameweeks(PL_GAMEWEEKS), options({ seed }));
    expect(draw("league-a")).toEqual(draw("league-a"));
    expect(draw("league-a")).not.toEqual(draw("league-b"));
  });

  test("seeded numbers are the same from the same seed, and in [0, 1)", () => {
    const [one, other] = [seededRandom("x"), seededRandom("x")];
    const numbers = Array.from({ length: 1000 }, () => one());
    expect(numbers).toEqual(Array.from({ length: 1000 }, () => other()));
    expect(numbers.every((number) => number >= 0 && number < 1)).toBe(true);
  });
});

test("an unplayed gameweek has no fixtures, and the rounds it would have had move on to the next one played", () => {
  const withBreak = drawn(teamsOf(4), WITH_GAPS, options());
  const straight = drawn(teamsOf(4), seasonGameweeks(PL_GAMEWEEKS), options());
  expect(withBreak.map((each) => each.gameweek)).toEqual(WITH_GAPS);
  expect(withBreak.find((each) => each.gameweek === 20)?.fixtures).toEqual(straight[16].fixtures);
});

test("S03.4, S09.4: the team left over plays the league's average, never a bye", () => {
  const [week] = drawn(teamsOf(3), [1], options());
  expect(week.byes).toEqual([]);
  expect(week.fixtures).toHaveLength(2);
  expect(week.fixtures.filter(({ opponent }) => opponent === LEAGUE_AVERAGE)).toHaveLength(1);
});

test.each([0, 1])("%i teams have no one to play, so no fixtures", (count) => {
  expect(drawn(teamsOf(count), seasonGameweeks(PL_GAMEWEEKS), options())).toEqual([]);
});
