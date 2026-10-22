import { describe, expect, test } from "vitest";
import { drawFixtures, gamesInAGameweek, LEAGUE_AVERAGE, ODD_TEAM_OUTS, roundsOf, type DrawRules, type GameweekFixtures } from "../../../convex/table/roundRobin";
import { drawn, leftOverIn, opponentsIn, pairKey, SEED, spread, tally, teamsOf, WITH_GAPS } from "../../support/convex/roundRobin.harness";

// The round robin under a change of rules (#266; spec/09): the gameweeks before it keep their
// fixtures, the rest are drawn by it, and a league whose rules never change draws as it always did.

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
