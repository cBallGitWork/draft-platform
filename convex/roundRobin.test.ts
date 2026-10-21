import { describe, expect, test } from "vitest";
import {
  drawFixtures,
  gamesInAGameweek,
  LEAGUE_AVERAGE,
  ODD_TEAM_OUTS,
  roundOrder,
  roundsOf,
  seededRandom,
  type DrawOptions,
  type GameweekFixtures,
} from "./roundRobin";
import { SEASON_GAMEWEEKS, usedGameweeksOf } from "./usedGameweeks";

// The round robin (#33, #130; spec/09): as even as can be over a season, one or more games a
// gameweek, never the same opponent twice in a gameweek, each round robin in its own order, drawn
// the same from the same seed, and only over the gameweeks the league plays.

const teamsOf = (count: number) => Array.from({ length: count }, (_, index) => `Team ${index + 1}`);
const TEAM_COUNTS = Array.from({ length: 19 }, (_, index) => index + 2); // 2 to 20
const GAMES = [1, 2, 3, 4];
const SEEDS = ["league-a", "league-b", "k57abc123"];
const pairKey = (one: string, other: string) => [one, other].toSorted().join(" v ");
const options = (change: Partial<DrawOptions> = {}): DrawOptions => ({ oddTeamOut: "leagueAverage", gamesPerGameweek: 1, seed: "league-a", ...change });

/** The spread of some counts: the most less the fewest. */
const spread = (counts: Iterable<number>) => Math.max(...counts) - Math.min(...counts);

/** How often each key comes up, every key in `keys` counted from 0. */
function tally(keys: readonly string[], seen: readonly string[]): Map<string, number> {
  const counts = new Map(keys.map((key) => [key, 0]));
  for (const key of seen) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

/** Each team's opponents in a gameweek, the league's average among them. */
function opponentsIn({ fixtures }: GameweekFixtures<string>): Map<string, string[]> {
  const opponents = new Map<string, string[]>();
  const add = (team: string, opponent: string) => opponents.set(team, [...(opponents.get(team) ?? []), opponent]);
  for (const { team, opponent } of fixtures) {
    add(team, opponent);
    if (opponent !== LEAGUE_AVERAGE) add(opponent, team);
  }
  return opponents;
}

/** Who is left over in a gameweek: on a bye, or against the league's average. */
const leftOverIn = ({ fixtures, byes }: GameweekFixtures<string>) => [
  ...byes,
  ...fixtures.filter((fixture) => fixture.opponent === LEAGUE_AVERAGE).map((fixture) => fixture.team),
];

/** A season with a Christmas break and an early end: 33 gameweeks played. */
const WITH_GAPS = usedGameweeksOf({ unusedGameweeks: [17, 18, 19, 37, 38] });

describe.each(ODD_TEAM_OUTS)("as even as can be, the odd team out playing %s", (oddTeamOut) => {
  const cases = TEAM_COUNTS.flatMap((count) => GAMES.flatMap((games) => SEEDS.map((seed) => [count, games, seed] as const)));

  test.each(cases)("%i teams, %i a gameweek, seed %s, over a season with gaps", (count, games, seed) => {
    const teams = teamsOf(count);
    const schedule = drawFixtures(teams, WITH_GAPS, { oddTeamOut, gamesPerGameweek: games, seed });
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
      for (const [team, opponents] of opponentsIn(gameweek)) {
        expect(new Set(opponents).size, `${team} in gameweek ${gameweek.gameweek}`).toBe(opponents.length);
      }
      const byes = tally(teams, gameweek.byes);
      for (const team of teams) {
        expect((opponentsIn(gameweek).get(team)?.length ?? 0) + (byes.get(team) ?? 0)).toBe(perGameweek);
      }
    }
  });
});

test.each(TEAM_COUNTS)("%i teams: one round robin, a game a gameweek, has every pair meet once and each team left over once at most", (count) => {
  const teams = teamsOf(count);
  const rounds = roundsOf(teams).length;
  expect(rounds).toBe(count % 2 === 0 ? count - 1 : count);
  const schedule = drawFixtures(teams, SEASON_GAMEWEEKS.slice(0, rounds), options({ oddTeamOut: "bye" }));
  const meetings = schedule.flatMap(({ fixtures }) => fixtures.map(({ team, opponent }) => pairKey(team, opponent as string)));
  expect(meetings).toHaveLength(new Set(meetings).size);
  expect(meetings).toHaveLength((count * (count - 1)) / 2);
  expect(schedule.flatMap((gameweek) => gameweek.byes).toSorted()).toEqual(count % 2 === 0 ? [] : teams.toSorted());
});

describe("games a gameweek", () => {
  test("with two, each team meets two different opponents every gameweek", () => {
    for (const gameweek of drawFixtures(teamsOf(6), SEASON_GAMEWEEKS, options({ gamesPerGameweek: 2 }))) {
      for (const opponents of opponentsIn(gameweek).values()) expect(new Set(opponents).size).toBe(2);
    }
  });

  test("more than a league has opponents for plays as many as there are: 3 teams meet 2 and the average at most", () => {
    const [first] = drawFixtures(teamsOf(3), [1], options({ gamesPerGameweek: 4 }));
    for (const opponents of opponentsIn(first).values()) expect(opponents).toHaveLength(3);
    const [withByes] = drawFixtures(teamsOf(3), [1], options({ gamesPerGameweek: 4, oddTeamOut: "bye" }));
    for (const opponents of opponentsIn(withByes).values()) expect(opponents).toHaveLength(2);
    expect(withByes.byes.toSorted()).toEqual(teamsOf(3));
  });

  test.each([[2, 1], [4, 3], [9, 9], [20, 19]])("%i teams have at most %i a gameweek", (count, most) => {
    expect(gamesInAGameweek(roundsOf(teamsOf(count)).length, 99)).toBe(most);
  });

  test("a gameweek straddling two round robins never has a round twice", () => {
    // 5 rounds, 3 a gameweek: the second gameweek takes 2 from the first round robin, 1 from the next.
    for (const seed of SEEDS) {
      const order = roundOrder(5, 30, 3, seed);
      for (let start = 0; start < order.length; start += 3) {
        const gameweek = order.slice(start, start + 3);
        expect(new Set(gameweek).size).toBe(gameweek.length);
      }
    }
  });
});

describe("the order", () => {
  test("each round robin plays every round once", () => {
    const order = roundOrder(7, 7 * 4, 1, "league-a");
    for (let start = 0; start < order.length; start += 7) expect(order.slice(start, start + 7).toSorted()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  test("isn't one order repeated: the round robins come in different orders", () => {
    const order = roundOrder(7, 7 * 4, 1, "league-a");
    const cycles = new Set([0, 7, 14, 21].map((start) => order.slice(start, start + 7).join()));
    expect(cycles.size).toBeGreaterThan(1);
  });

  test("is the same from the same seed, and differs from another", () => {
    const draw = (seed: string) => drawFixtures(teamsOf(8), SEASON_GAMEWEEKS, options({ seed }));
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
  const withBreak = drawFixtures(teamsOf(4), WITH_GAPS, options());
  const straight = drawFixtures(teamsOf(4), SEASON_GAMEWEEKS, options());
  expect(withBreak.map((each) => each.gameweek)).toEqual(WITH_GAPS);
  expect(withBreak.find((each) => each.gameweek === 20)?.fixtures).toEqual(straight[16].fixtures);
});

test("the team left over has a bye, or plays the league's average, as the league says", () => {
  const [byeWeek] = drawFixtures(teamsOf(3), [1], options({ oddTeamOut: "bye" }));
  const [averageWeek] = drawFixtures(teamsOf(3), [1], options());
  expect(byeWeek.byes).toHaveLength(1);
  expect(averageWeek.byes).toEqual([]);
  expect(averageWeek.fixtures).toEqual([...byeWeek.fixtures, { team: byeWeek.byes[0], opponent: LEAGUE_AVERAGE }]);
});

test.each([0, 1])("%i teams have no one to play, so no fixtures", (count) => {
  expect(drawFixtures(teamsOf(count), SEASON_GAMEWEEKS, options())).toEqual([]);
});
