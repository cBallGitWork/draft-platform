import { expect, test } from "vitest";
import { annsScoredGame, GAMEWEEK, HULL_SCORER, HULL_STRIKER, leavesAnnsSquad, scoresLeague, type ScoresLeague } from "../../support/convex/gameweekScores.harness";

// The matchup names each side's formation by its preset until the manager edits it (spec/10, The
// matchup, as a live match: "preset until its edited, then we name it"; #878). Ann's Hull stand in
// a 5-4-1, Bob's Everton in a 4-5-1. What an edited shape is called waits on Craig, so it is null.

/** Moves Ann's lone striker from attack's centre to its left-centre cell: no preset's shape. */
const annEditsHerShape = ({ t, leagueId, annsTeam }: ScoresLeague) =>
  t.run(async (ctx) => {
    const row = (await ctx.db
      .query("lineups")
      .withIndex("by_leagueId_and_teamId_and_fromGameweek", (q) => q.eq("leagueId", leagueId).eq("teamId", annsTeam))
      .unique())!;
    const starters = row.starters.map((starter) => (starter.playerCode === HULL_STRIKER ? { ...starter, lane: "leftCentre" as const } : starter));
    await ctx.db.patch("lineups", row._id, { starters });
  });

test("each side's formation is the name of the preset its lineup stands in", async () => {
  const game = await annsScoredGame(await scoresLeague(), GAMEWEEK);

  expect(game.team).toMatchObject({ formation: "5-4-1" });
  expect(game.opponent).toMatchObject({ formation: "4-5-1" });
});

test("a side its manager has edited off every preset has no formation name yet", async () => {
  const league = await scoresLeague();
  await annEditsHerShape(league);
  const game = await annsScoredGame(league, GAMEWEEK);

  expect(game.team).toMatchObject({ formation: null });
  expect(game.opponent).toMatchObject({ formation: "4-5-1" });
});

test("a side that never saved is named by the preset its first lineup filled (#637, #836)", async () => {
  const game = await annsScoredGame(await scoresLeague({ bobSaves: false }), GAMEWEEK);

  expect(game.opponent).toMatchObject({ formation: "4-3-3" });
});

test("a slot left empty by a starter gone from the squad is still the preset's: the manager didn't edit it", async () => {
  const league = await scoresLeague();
  await leavesAnnsSquad(league, HULL_SCORER);
  const game = await annsScoredGame(league, GAMEWEEK);

  expect(game.team).toMatchObject({ formation: "5-4-1" });
});
