import { describe, expect, test } from "vitest";
import {
  drawFixtures,
  gamesInAGameweek,
  LEAGUE_AVERAGE,
  ODD_TEAM_OUTS,
  roundOrder,
  roundsOf,
  seededRandom,
  type DrawRules,
  type GameweekFixtures,
} from "../../../convex/table/roundRobin";
import { SEASON_GAMEWEEKS, usedGameweeksOf } from "../../../convex/gameweeks/usedGameweeks";

// The round robin (#33, #130; spec/09): as even as can be over a season, one or more games a
// gameweek, never the same opponent twice in a gameweek, each round robin in its own order, drawn
// the same from the same seed, and only over the gameweeks the league plays.

const teamsOf = (count: number) => Array.from({ length: count }, (_, index) => `Team ${index + 1}`);
const TEAM_COUNTS = Array.from({ length: 19 }, (_, index) => index + 2); // 2 to 20
const GAMES = [1, 2, 3, 4];
const SEEDS = ["league-a", "league-b", "k57abc123"];
const SEED = "league-a";
const pairKey = (one: string, other: string) => [one, other].toSorted().join(" v ");
type DrawOptions = DrawRules & { seed: string };
/** The draw of a league whose rules never change. */
const drawn = (teams: readonly string[], gameweeks: readonly number[], { seed, ...rules }: DrawOptions) => drawFixtures(teams, gameweeks, () => rules, seed);
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
    const schedule = drawn(teams, WITH_GAPS, { oddTeamOut, gamesPerGameweek: games, seed });
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
      const byes = tally(teams, gameweek.byes);
      for (const team of teams) {
        const met = opponents.get(team) ?? [];
        expect(new Set(met).size, `${team} in gameweek ${gameweek.gameweek}`).toBe(met.length);
        expect(met.length + (byes.get(team) ?? 0)).toBe(perGameweek);
      }
    }
  });
});

test.each(TEAM_COUNTS)("%i teams: one round robin, a game a gameweek, has every pair meet once and each team left over once at most", (count) => {
  const teams = teamsOf(count);
  const rounds = roundsOf(teams).length;
  expect(rounds).toBe(count % 2 === 0 ? count - 1 : count);
  const schedule = drawn(teams, SEASON_GAMEWEEKS.slice(0, rounds), options({ oddTeamOut: "bye" }));
  const meetings = schedule.flatMap(({ fixtures }) => fixtures.map(({ team, opponent }) => pairKey(team, opponent as string)));
  expect(meetings).toHaveLength(new Set(meetings).size);
  expect(meetings).toHaveLength((count * (count - 1)) / 2);
  expect(schedule.flatMap((gameweek) => gameweek.byes).toSorted()).toEqual(count % 2 === 0 ? [] : teams.toSorted());
});

describe("games a gameweek", () => {
  test.each(ODD_TEAM_OUTS)("with an odd number of teams, nobody is left over twice in a gameweek, playing %s", (oddTeamOut) => {
    // Each round leaves one team over, a different one each round, and a gameweek never has a
    // round twice: so a team plays the league's average, or sits out, once a gameweek at most.
    for (const count of [3, 5, 7, 9, 19]) {
      for (const games of GAMES) {
        for (const seed of SEEDS) {
          for (const gameweek of drawn(teamsOf(count), WITH_GAPS, { oddTeamOut, gamesPerGameweek: games, seed })) {
            const leftOver = [...gameweek.byes, ...gameweek.fixtures.filter((each) => each.opponent === LEAGUE_AVERAGE).map((each) => each.team)];
            expect(new Set(leftOver).size, `${count} teams, ${games} a gameweek, gameweek ${gameweek.gameweek}`).toBe(leftOver.length);
          }
        }
      }
    }
  });

  test("with two, each team meets two different opponents every gameweek", () => {
    for (const gameweek of drawn(teamsOf(6), SEASON_GAMEWEEKS, options({ gamesPerGameweek: 2 }))) {
      for (const opponents of opponentsIn(gameweek).values()) expect(new Set(opponents).size).toBe(2);
    }
  });

  test("more than a league has opponents for plays as many as there are: 3 teams meet 2 and the average at most", () => {
    const [first] = drawn(teamsOf(3), [1], options({ gamesPerGameweek: 4 }));
    for (const opponents of opponentsIn(first).values()) expect(opponents).toHaveLength(3);
    const [withByes] = drawn(teamsOf(3), [1], options({ gamesPerGameweek: 4, oddTeamOut: "bye" }));
    for (const opponents of opponentsIn(withByes).values()) expect(opponents).toHaveLength(2);
    expect(withByes.byes.toSorted()).toEqual(teamsOf(3));
  });

  test.each([[2, 1], [4, 3], [9, 9], [20, 19]])("%i teams have at most %i a gameweek", (count, most) => {
    expect(gamesInAGameweek(roundsOf(teamsOf(count)).length, 99)).toBe(most);
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
    const draw = (seed: string) => drawn(teamsOf(8), SEASON_GAMEWEEKS, options({ seed }));
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
  const straight = drawn(teamsOf(4), SEASON_GAMEWEEKS, options());
  expect(withBreak.map((each) => each.gameweek)).toEqual(WITH_GAPS);
  expect(withBreak.find((each) => each.gameweek === 20)?.fixtures).toEqual(straight[16].fixtures);
});

test("the team left over has a bye, or plays the league's average, as the league says", () => {
  const [byeWeek] = drawn(teamsOf(3), [1], options({ oddTeamOut: "bye" }));
  const [averageWeek] = drawn(teamsOf(3), [1], options());
  expect(byeWeek.byes).toHaveLength(1);
  expect(averageWeek.byes).toEqual([]);
  expect(averageWeek.fixtures).toEqual([...byeWeek.fixtures, { team: byeWeek.byes[0], opponent: LEAGUE_AVERAGE }]);
});

test.each([0, 1])("%i teams have no one to play, so no fixtures", (count) => {
  expect(drawn(teamsOf(count), SEASON_GAMEWEEKS, options())).toEqual([]);
});

describe("a change of rules from a gameweek on (#266: \"games played in past are done\")", () => {
  const BEFORE: DrawRules = { oddTeamOut: "leagueAverage", gamesPerGameweek: 1 };
  const CHANGES: DrawRules[] = [
    { oddTeamOut: "leagueAverage", gamesPerGameweek: 2 },
    { oddTeamOut: "bye", gamesPerGameweek: 1 },
    { oddTeamOut: "bye", gamesPerGameweek: 3 },
  ];
  /** The first gameweek of the season, one after a gap, and two inside a run. */
  const FROM = [WITH_GAPS[0], 20, 9, 33];
  const cases = [3, 4, 5, 7, 8, 10].flatMap((count) => CHANGES.flatMap((after) => FROM.map((from) => [count, after, from] as const)));

  test.each(cases)("%i teams, changed to %o from gameweek %i", (count, after, from) => {
    const teams = teamsOf(count);
    for (const [first, then] of [[BEFORE, after], [after, BEFORE]]) {
      const unchanged = drawFixtures(teams, WITH_GAPS, () => first, SEED);
      const changed = drawFixtures(teams, WITH_GAPS, (gameweek) => (gameweek < from ? first : then), SEED);
      const before = (schedule: GameweekFixtures<string>[]) => schedule.filter(({ gameweek }) => gameweek < from);
      const since = (schedule: GameweekFixtures<string>[]) => schedule.filter(({ gameweek }) => gameweek >= from);

      // The gameweeks before the change keep their fixtures, whole.
      expect(before(changed)).toEqual(before(unchanged));
      // An even league has no one left over, so the odd team out alone changes nothing.
      const changesAnything = first.gamesPerGameweek !== then.gamesPerGameweek || count % 2 === 1;
      if (changesAnything) expect(since(changed)).not.toEqual(since(unchanged));
      else expect(changed).toEqual(unchanged);
      expect(changed.map(({ gameweek }) => gameweek)).toEqual(WITH_GAPS);

      // From the change on, each gameweek is drawn by the new rules, a team never meeting one
      // opponent twice in it nor left over twice.
      const perGameweek = gamesInAGameweek(roundsOf(teams).length, then.gamesPerGameweek);
      for (const gameweek of since(changed)) {
        const opponents = opponentsIn(gameweek);
        const byes = tally(teams, gameweek.byes);
        if (then.oddTeamOut === "bye") expect(gameweek.fixtures.some(({ opponent }) => opponent === LEAGUE_AVERAGE)).toBe(false);
        else expect(gameweek.byes).toEqual([]);
        expect(new Set(leftOverIn(gameweek)).size).toBe(leftOverIn(gameweek).length);
        for (const team of teams) {
          const met = opponents.get(team) ?? [];
          expect(new Set(met).size, `${team} in gameweek ${gameweek.gameweek}`).toBe(met.length);
          expect(met.length + (byes.get(team) ?? 0)).toBe(perGameweek);
        }
      }

      // And the season stays as even as can be: the rounds carry on where they were left.
      const everyPair = teams.flatMap((one, index) => teams.slice(index + 1).map((other) => pairKey(one, other)));
      const meetings = changed.flatMap(({ fixtures }) =>
        fixtures.flatMap(({ team, opponent }) => (opponent === LEAGUE_AVERAGE ? [] : [pairKey(team, opponent)])),
      );
      expect(spread(tally(everyPair, meetings).values())).toBeLessThanOrEqual(1);
      if (count % 2 === 1) expect(spread(tally(teams, changed.flatMap(leftOverIn)).values())).toBeLessThanOrEqual(1);
    }
  });
});

/** The draws the golden file pins: every odd team out, a few team counts and games a gameweek. */
const GOLDEN_TEAM_COUNTS = [2, 3, 4, 7, 10];
const GOLDEN_GAMES = [1, 2, 3];
const GOLDEN_SEED = "golden-league";
const AVERAGE_WORD = "average";

/** A gameweek as one line, so a diff of the golden names exactly what moved. */
const goldenLine = ({ gameweek, fixtures, byes }: GameweekFixtures<string>) =>
  `${gameweek}: ${fixtures.map(({ team, opponent }) => `${team} v ${opponent === LEAGUE_AVERAGE ? AVERAGE_WORD : opponent}`).join(", ")}` +
  (byes.length === 0 ? "" : ` | byes ${byes.join(", ")}`);

test("a league whose rules never change is drawn as the golden file pins, over a season with gaps", async () => {
  const lines = ODD_TEAM_OUTS.flatMap((oddTeamOut) =>
    GOLDEN_TEAM_COUNTS.flatMap((count) =>
      GOLDEN_GAMES.flatMap((games) => [
        `# ${count} teams, ${games} a gameweek, odd team out ${oddTeamOut}`,
        ...drawn(teamsOf(count), WITH_GAPS, { oddTeamOut, gamesPerGameweek: games, seed: GOLDEN_SEED }).map(goldenLine),
      ]),
    ),
  );
  await expect(`${lines.join("\n")}\n`).toMatchFileSnapshot("../../support/golden/round-robin.txt");
});
