import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { ANN, annsScoredGame, fullTimeRecords, GAMEWEEK, HULL_BENCH, HULL_SCORER, lineupOf, nameOf, scoresLeague } from "../../support/convex/gameweekScores.harness";
import { actingAs } from "../../support/convex/leagues.harness";

// The matchup when a starter has left the squad before the deadline (#597; spec/05, Auto-subs: his
// slot "is filled from the bench the same way, as if he hadn't played"). Ann fields Hull; their
// scorer, a midfielder, has left her squad, so Belloumi, the first midfielder on her bench, takes
// his slot, and the matchup says whose slot it was.

/** Belloumi, Hull's midfielder on at 64 minutes, second on Ann's bench after Hull's keeper. */
const [, BELLOUMI] = HULL_BENCH;

test("a sub into a slot left empty by a starter who left the squad shows as on for him, and the totals match the table", async () => {
  const league = await scoresLeague();
  await league.t.run(async (ctx) => {
    const owned = (await ctx.db
      .query("squadPlayers")
      .withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", league.leagueId).eq("playerCode", HULL_SCORER))
      .unique())!;
    await ctx.db.delete("squadPlayers", owned._id);
  });
  await fullTimeRecords(league);

  const ann = await actingAs(league.t, ANN);
  const game = await annsScoredGame(league, GAMEWEEK);
  const slots = [...lineupOf(game.team).starters, ...lineupOf(game.team).bench];
  const scorersName = await nameOf(league, HULL_SCORER);

  expect(slots.find((slot) => slot.playerCode === BELLOUMI)).toMatchObject({ counts: true, area: "midfield", autoSub: { kind: "on", playerName: scorersName } });
  expect(slots.some((slot) => slot.playerCode === HULL_SCORER)).toBe(false);
  const table = await ann.query(api.table.leagueTable.ofLeague, { leagueId: league.leagueId });
  expect(table!.gameweeks.find((each) => each.gameweek === GAMEWEEK)!.fixtures[0].points!.team).toBe(game.team.points);
});
