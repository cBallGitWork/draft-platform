import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { inTenths } from "../../../convex/scoring/values";
import { actingAs } from "../../support/convex/leagues.harness";
import { silenceConsoleError } from "../../support/convex/test.harness";
import {
  ANN,
  BOB,
  CAT,
  EVERTON_POINTS,
  fullTimeRecords,
  GAMEWEEK,
  holdTypoRule,
  HULL_POINTS,
  lockMatch,
  readTable,
  scoresLeague,
  TYPO_STAT,
  type ScoresLeague,
} from "../../support/convex/gameweekScores.harness";

// My team's Fixtures tab's results (#436): each game's score is the table's own, the team's points
// first, provisional while live; a game not yet played, or in a gameweek that couldn't be scored,
// has none. Gameweek 6 is begun with Hull v Everton in it (gameweekScores.harness.ts).

const readFixtures = async ({ t, leagueId }: ScoresLeague, email = ANN) => (await (await actingAs(t, email)).query(api.table.teamFixtures.ofMyTeam, { leagueId }))!;
const gameIn = (fixtures: Awaited<ReturnType<typeof readFixtures>>, gameweek = GAMEWEEK) => fixtures.games.find((game) => game.gameweek === gameweek)!;

test("a game played and final has the table's score, each team's own points first, and its team for the matchup's link", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);

  const ann = await readFixtures(league);
  expect(ann.teamId).toBe(league.annsTeam);
  expect(gameIn(ann).score).toEqual({ team: HULL_POINTS, opponent: EVERTON_POINTS, provisional: false });
  expect(gameIn(await readFixtures(league, BOB)).score).toEqual({ team: EVERTON_POINTS, opponent: HULL_POINTS, provisional: false });

  const tableFixture = (await readTable(league))!.gameweeks.find((each) => each.gameweek === GAMEWEEK)!.fixtures[0];
  expect(tableFixture.points).toEqual({ team: gameIn(ann).score!.team, opponent: gameIn(ann).score!.opponent });
  expect(ann.unscored).toEqual([]);
});

test("a game live, inside the corrections window, is scored provisionally, then final once the match locks", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  expect(gameIn(await readFixtures(league)).score).toEqual({ team: HULL_POINTS, opponent: EVERTON_POINTS, provisional: true });
  await lockMatch(league);
  expect(gameIn(await readFixtures(league)).score?.provisional).toBe(false);
});

test("a game not yet played has no score", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  const unplayed = (await readFixtures(league)).games.filter((game) => game.gameweek !== GAMEWEEK);
  expect(unplayed.length).toBeGreaterThan(0);
  expect(unplayed.every((game) => game.score === null)).toBe(true);
});

test("a game against the league's average scores the average, provisional while any team's points are", async () => {
  const league = await scoresLeague({ catToo: true });
  await fullTimeRecords(league);
  // Cat's team saved no lineup, so it scores 0 and counts in the average as 0.
  const average = inTenths((HULL_POINTS + EVERTON_POINTS + 0) / 3);
  const live = gameIn(await readFixtures(league, CAT));
  expect(live.against).toEqual({ kind: "leagueAverage" });
  expect(live.score).toEqual({ team: 0, opponent: average, provisional: true });

  await lockMatch(league);
  expect(gameIn(await readFixtures(league, CAT)).score).toEqual({ team: 0, opponent: average, provisional: false });
});

test("a gameweek that can't be scored has no score, and is named with the reason as the table names it (#287)", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await holdTypoRule(league);
  silenceConsoleError();

  const fixtures = await readFixtures(league);
  expect(gameIn(fixtures).score).toBeNull();
  expect(fixtures.unscored).toEqual([{ gameweek: GAMEWEEK, reason: expect.stringContaining(`"${TYPO_STAT}"`) }]);
  expect(fixtures.unscored).toEqual((await readTable(league))!.unscored);
});
