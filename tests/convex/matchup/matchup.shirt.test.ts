import { expect, test } from "vitest";
import { annsScoredGame, GAMEWEEK, HULL_SCORER, scoresLeague, slotOf } from "../../support/convex/gameweekScores.harness";
import { fullTimeRecords } from "../../support/convex/gameweekScoresMatch.harness";
import { HULL } from "../../support/convex/matchStats.harness";

// Each man's shirt on the matchup's pitch (#1026): his club's colours and the number on it, his
// manager's while the team still holds him (#13), and each side's "Auto team" tag (#1207).

/** Ann gives her scorer squad number 10. */
const numbersScorer = ({ t, leagueId }: Awaited<ReturnType<typeof scoresLeague>>) =>
  t.run(async (ctx) => {
    const row = await ctx.db
      .query("squadPlayers")
      .withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId).eq("playerCode", HULL_SCORER))
      .unique();
    await ctx.db.patch("squadPlayers", row!._id, { number: 10 });
  });

test("a man wears his club and his manager's number, and a team with a manager isn't on the auto team", async () => {
  const league = await scoresLeague();
  await numbersScorer(league);
  await fullTimeRecords(league);

  const game = await annsScoredGame(league, GAMEWEEK);

  expect(slotOf(game.team, HULL_SCORER)).toMatchObject({ clubCode: HULL, number: 10 });
  expect(game.team).toMatchObject({ autoTeam: false });
  expect(game.opponent).toMatchObject({ autoTeam: false });
});

test("a team with no manager shows on the auto team", async () => {
  const league = await scoresLeague();
  await league.t.run((ctx) => ctx.db.patch("teams", league.bobsTeam, { managerEmail: undefined }));
  await fullTimeRecords(league);

  expect((await annsScoredGame(league, GAMEWEEK)).opponent).toMatchObject({ autoTeam: true });
});
