import { expect, test } from "vitest";
import { ANNS_TEAM, BOBS_TEAM, GAMEWEEK, matchupAs, scoresLeague, type ScoresLeague } from "../../support/convex/gameweekScores.harness";
import { teamNumbered } from "../../../convex/leagues/teams";
import { ANN } from "../../support/convex/leagues.harness";

// A league playing two head-to-heads a gameweek (#521; Craig, 6 Nov 2026): the matchup shows one
// game at a time, the first as drawn unless the address names another, with every game of the
// gameweek listed for the switch; the stepper still steps gameweek by gameweek; one lineup and one
// score for the gameweek, the same in each game. S10.2

/** Cat's team, as the league names a third team. */
const CATS_TEAM = teamNumbered(3);

/** Gameweek 6 drawn with two games for Ann: Bob first, then Cat. */
async function twoGamesLeague(): Promise<ScoresLeague> {
  const league = await scoresLeague({ catToo: true });
  const { t, leagueId, annsTeam, bobsTeam, catsTeam } = league;
  await t.run(async (ctx) => {
    const stored = await ctx.db
      .query("playedFixtures")
      .withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", leagueId).eq("gameweek", GAMEWEEK))
      .unique();
    await ctx.db.patch("playedFixtures", stored!._id, {
      fixtures: [
        { team: annsTeam, opponent: bobsTeam },
        { team: catsTeam!, opponent: annsTeam },
      ],
    });
  });
  return league;
}

const scoredIn = async (league: ScoresLeague, game?: number) => {
  const read = await matchupAs(league, ANN, { gameweek: GAMEWEEK, ...(game === undefined ? {} : { game }) });
  if (read?.kind !== "headToHead" || read.game.kind !== "scored") throw new Error(`Ann's matchup isn't scored: ${JSON.stringify(read)}`);
  return read;
};

test("with two games a gameweek the first drawn shows unless another is named, every game listed for the switch", async () => {
  const league = await twoGamesLeague();
  const first = await scoredIn(league);
  expect(first.gameNumber).toBe(1);
  expect(first.games).toEqual([
    { kind: "team", teamName: BOBS_TEAM },
    { kind: "team", teamName: CATS_TEAM },
  ]);
  expect(first.game).toMatchObject({ team: { teamName: ANNS_TEAM }, opponent: { teamName: BOBS_TEAM } });
  // The stepper steps gameweeks: gameweek 6 once, however many games it holds.
  expect(first.gameweeks.filter((each) => each === GAMEWEEK)).toHaveLength(1);

  const second = await scoredIn(league, 2);
  expect(second.gameNumber).toBe(2);
  expect(second.games).toEqual(first.games);
  expect(second.game).toMatchObject({ opponent: { kind: "team", teamName: CATS_TEAM } });
  // One lineup and one score for the gameweek, the same against each opponent.
  if (first.game.kind !== "scored" || second.game.kind !== "scored") throw new Error("both games are scored");
  expect(second.game.team).toEqual(first.game.team);
});

test.each([0, 3])("a game number the gameweek doesn't hold (%i) shows the first", async (game) => {
  const league = await twoGamesLeague();
  const read = await scoredIn(league, game);
  expect(read.gameNumber).toBe(1);
  expect(read.game).toMatchObject({ opponent: { teamName: BOBS_TEAM } });
});

test("with one game a gameweek the switch's list holds just it", async () => {
  const league = await scoresLeague();
  const read = await scoredIn(league);
  expect(read).toMatchObject({ gameNumber: 1, games: [{ kind: "team", teamName: BOBS_TEAM }] });
});
