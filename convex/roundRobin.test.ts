import { describe, expect, test } from "vitest";
import { drawFixtures, LEAGUE_AVERAGE, ODD_TEAM_OUTS, roundsOf, type GameweekFixtures } from "./roundRobin";
import { GAMEWEEKS } from "./usedGameweeks";

// The round robin (#33; spec/09): every pair meets once a round robin, nobody plays twice in a
// gameweek, the team left over is a different one each gameweek of a round robin, it repeats
// once the gameweeks outnumber its rounds, and only the gameweeks the league plays have fixtures.

const teamsOf = (count: number) => Array.from({ length: count }, (_, index) => `Team ${index + 1}`);
const everyGameweek = Array.from({ length: GAMEWEEKS }, (_, index) => index + 1);
const TEAM_COUNTS = Array.from({ length: 19 }, (_, index) => index + 2); // 2 to 20
const pairKey = (one: string, other: string) => [one, other].toSorted().join(" v ");

/** Who plays in a gameweek, the team left over among them. */
function playing({ fixtures, bye }: GameweekFixtures<string>): string[] {
  const teams = fixtures.flatMap(({ team, opponent }) => (opponent === LEAGUE_AVERAGE ? [team] : [team, opponent]));
  return bye === null ? teams : [...teams, bye];
}

/** How many times each team is left over (on a bye, or playing the average) in these gameweeks. */
function leftOverCounts(schedule: readonly GameweekFixtures<string>[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { fixtures, bye } of schedule) {
    const leftOver = bye ?? fixtures.find((fixture) => fixture.opponent === LEAGUE_AVERAGE)?.team;
    if (leftOver !== undefined) counts.set(leftOver, (counts.get(leftOver) ?? 0) + 1);
  }
  return counts;
}

describe.each(ODD_TEAM_OUTS)("with the odd team out playing %s", (oddTeamOut) => {
  test.each(TEAM_COUNTS)("%i teams: in one round robin every pair meets once, and nobody twice in a gameweek", (count) => {
    const teams = teamsOf(count);
    const rounds = roundsOf(teams).length;
    expect(rounds).toBe(count % 2 === 0 ? count - 1 : count);

    const schedule = drawFixtures(teams, everyGameweek.slice(0, rounds), oddTeamOut);
    const meetings = schedule.flatMap(({ fixtures }) =>
      fixtures.flatMap(({ team, opponent }) => (opponent === LEAGUE_AVERAGE ? [] : [pairKey(team, opponent)])),
    );
    const everyPair = teams.flatMap((one, index) => teams.slice(index + 1).map((other) => pairKey(one, other)));
    expect(meetings.toSorted()).toEqual(everyPair.toSorted());
    for (const gameweek of schedule) expect(playing(gameweek).toSorted()).toEqual(teams.toSorted());
  });

  test.each(TEAM_COUNTS)("%i teams: each is left over once a round robin, and over a season no more than once more than another", (count) => {
    const teams = teamsOf(count);
    const rounds = roundsOf(teams).length;
    const oneRoundRobin = leftOverCounts(drawFixtures(teams, everyGameweek.slice(0, rounds), oddTeamOut));
    const season = [...leftOverCounts(drawFixtures(teams, everyGameweek, oddTeamOut)).values()];
    if (count % 2 === 0) {
      expect(oneRoundRobin.size).toBe(0);
      expect(season).toEqual([]);
      return;
    }
    expect([...oneRoundRobin.values()]).toEqual(teams.map(() => 1));
    expect(season).toHaveLength(count);
    expect(Math.max(...season) - Math.min(...season)).toBeLessThanOrEqual(1);
  });
});

test("the team left over has a bye, or plays the league's average, as the league says", () => {
  const [byeWeek] = drawFixtures(teamsOf(3), [1], "bye");
  expect(byeWeek.fixtures).toHaveLength(1);
  expect(byeWeek.bye).not.toBeNull();
  expect(byeWeek.fixtures.some((fixture) => fixture.opponent === LEAGUE_AVERAGE)).toBe(false);

  const [averageWeek] = drawFixtures(teamsOf(3), [1], "leagueAverage");
  expect(averageWeek.bye).toBeNull();
  expect(averageWeek.fixtures).toEqual([byeWeek.fixtures[0], { team: byeWeek.bye, opponent: LEAGUE_AVERAGE }]);
});

test("an even league has no one left over, whatever its setting", () => {
  for (const gameweek of drawFixtures(teamsOf(4), everyGameweek, "leagueAverage")) {
    expect(gameweek.bye).toBeNull();
    expect(gameweek.fixtures.map((fixture) => fixture.opponent)).not.toContain(LEAGUE_AVERAGE);
  }
});

test("once the gameweeks outnumber its rounds, the round robin repeats in the same order", () => {
  const schedule = drawFixtures(teamsOf(6), everyGameweek, "leagueAverage");
  const fixturesIn = (gameweek: number) => schedule[gameweek - 1].fixtures;
  for (let gameweek = 6; gameweek <= GAMEWEEKS; gameweek += 1) expect(fixturesIn(gameweek)).toEqual(fixturesIn(gameweek - 5));
});

test("only the gameweeks the league plays have fixtures, and an unplayed one's round moves on to the next", () => {
  const teams = teamsOf(4);
  const played = everyGameweek.filter((gameweek) => ![17, 18, 19].includes(gameweek));
  const withBreak = drawFixtures(teams, played, "bye");
  const straight = drawFixtures(teams, everyGameweek, "bye");

  expect(withBreak.map((each) => each.gameweek)).toEqual(played);
  const fixturesOf = (schedule: GameweekFixtures<string>[], gameweek: number) => schedule.find((each) => each.gameweek === gameweek)?.fixtures;
  expect(fixturesOf(withBreak, 16)).toEqual(fixturesOf(straight, 16));
  expect(fixturesOf(withBreak, 20)).toEqual(fixturesOf(straight, 17));
});

test.each([0, 1])("%i teams have no one to play, so no fixtures", (count) => {
  expect(drawFixtures(teamsOf(count), everyGameweek, "leagueAverage")).toEqual([]);
});
