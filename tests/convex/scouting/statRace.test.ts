import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { refusals } from "../../../convex/shared/leagueAccess";
import { actingAs, OUTSIDER } from "../../support/convex/leagues.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { ANN, ANNS_TEAM, BOBS_TEAM, CAT, scoresLeague, type ScoresLeague } from "../../support/convex/gameweekScores.harness";

// Scouting's stat race (#800, spec/19 The stat race): every team in the league with its season
// totals, ranked by the stat the manager picks. Totals are written here as teamSeasonStats.ts
// keeps them, so this tests only the read.

const CATS_TEAM = "Team 3";

async function withTotals(league: ScoresLeague) {
  await league.t.run(async (ctx) => {
    const { leagueId, annsTeam, bobsTeam } = league;
    await ctx.db.insert("teamSeasonStats", { leagueId, teamId: annsTeam, stats: { goals_scored: 3, clean_sheets: 1, bonus: 9 } });
    await ctx.db.insert("teamSeasonStats", { leagueId, teamId: bobsTeam, stats: { goals_scored: 5 } });
  });
}

const race = async ({ t, leagueId }: ScoresLeague, stat: string, descending = true, email = ANN) =>
  (await actingAs(t, email)).query(api.scouting.statRace.teams, { leagueId, stat, descending });

test("every team is ranked by the stat picked, most first, a team with none of it at 0", async () => {
  const league = await scoresLeague({ catToo: true });
  await withTotals(league);

  const ranked = await race(league, "goals_scored");
  expect(ranked.map(({ name, stat }) => [name, stat])).toEqual([
    [BOBS_TEAM, 5],
    [ANNS_TEAM, 3],
    [CATS_TEAM, 0],
  ]);
  expect(ranked.find((team) => team.name === CATS_TEAM)!.stats).toEqual({});
});

test("fewest first when asked, and ties fall back to the team's name", async () => {
  const league = await scoresLeague({ catToo: true });
  await withTotals(league);

  expect((await race(league, "clean_sheets", false)).map(({ name, stat }) => [name, stat])).toEqual([
    [BOBS_TEAM, 0],
    [CATS_TEAM, 0],
    [ANNS_TEAM, 1],
  ]);
});

test("only the catalogue's stats are shown: FPL's own bonus never is", async () => {
  const league = await scoresLeague();
  await withTotals(league);

  const anns = (await race(league, "goals_scored")).find((team) => team.name === ANNS_TEAM)!;
  expect(anns.stats).toEqual({ goals_scored: 3, clean_sheets: 1 });
  await expect(race(league, "bonus")).rejects.toThrow("No stat bonus is in the catalogue");
});

test("anyone not in the league is refused", async () => {
  const league = await scoresLeague();
  await expectRefused(race(league, "goals_scored", true, OUTSIDER), refusals.notInLeague);
  // Cat holds no team in this two-team league.
  await expectRefused(race(league, "goals_scored", true, CAT), refusals.notInLeague);
});
