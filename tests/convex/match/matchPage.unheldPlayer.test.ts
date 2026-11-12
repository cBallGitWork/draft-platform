import { expect, test } from "vitest";
import type { MatchMan } from "../../../convex/match/matchPage";
import { unheldPlayerWords } from "../../../convex/shared/players";
import { ANNS_TEAM, annsScoredGame, HULL_SCORER, lineupOf, losePlayer } from "../../support/convex/gameweekScores.harness";
import { fullTimeRecords } from "../../support/convex/gameweekScoresMatch.harness";
import { holdLines, manOf, matchAs, matchLeague, scorerFreeLeague, storedLine } from "../../support/convex/matchPage.harness";
import { ANN, BOB } from "../../support/convex/leagues.harness";

// A match naming a man the football data no longer holds (#1765): his saved record stays (spec/14
// S14.5), so the match still names him. The page loads for everyone, his row says what's wrong where
// his name would be, as the matchup's does (matchup.unheldPlayer.test.ts), his side is the club his
// record kept, and every other man shows as before.

test("a starter the football data has lost shows the error words in his row, every lineup man's points as the matchup has them", async () => {
  const league = await matchLeague();
  await fullTimeRecords(league);
  await losePlayer(league, HULL_SCORER);

  const page = (await matchAs(league, BOB))!;
  expect(manOf(page.men, HULL_SCORER)).toMatchObject({ name: unheldPlayerWords(HULL_SCORER), side: "home", ownerTeamName: ANNS_TEAM });
  expect(page.pointsProblem).toBeNull();
  const { starters, bench } = lineupOf((await annsScoredGame(league)).team);
  for (const slot of [...starters, ...bench].filter(({ playerCode }) => playerCode !== HULL_SCORER)) {
    expect(manOf(page.men, slot.playerCode)).toMatchObject({ points: slot.points, counts: slot.counts });
  }
});

test("a man in no lineup the football data has lost shows the error words in his row, his points and every other man's as before", async () => {
  const league = await scorerFreeLeague();
  await holdLines(league, [storedLine(1, "64' GOAL Scorer", 64, "goal", [HULL_SCORER])]);
  const before = (await matchAs(league, ANN))!;
  await losePlayer(league, HULL_SCORER);

  const page = (await matchAs(league, ANN))!;
  expect(manOf(page.men, HULL_SCORER)).toEqual({ ...manOf(before.men, HULL_SCORER), name: unheldPlayerWords(HULL_SCORER) });
  expect(manOf(page.men, HULL_SCORER)).toMatchObject({ side: "home", ownerTeamName: null, points: expect.any(Number) });
  const others = (men: readonly MatchMan[]) => men.filter(({ playerCode }) => playerCode !== HULL_SCORER);
  expect(others(page.men)).toEqual(others(before.men));
  expect(page.commentary).toEqual(before.commentary);
});
