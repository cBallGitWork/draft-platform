import { expect, test } from "vitest";
import { leagueDeadlines } from "../../../convex/gameweeks/leagueDeadlines";
import { seasonRules } from "../../../convex/rules/rulesHistory";
import { inTenths } from "../../../convex/scoring/values";
import { storeBegunFixtures } from "../../../convex/table/playedFixtures";
import type { OddTeamOut } from "../../../convex/table/roundRobin";
import { EVERTON_POINTS, GAMEWEEK, HULL_POINTS, readTable, scoresLeague, type ScoresLeague } from "../../support/convex/gameweekScores.harness";
import { fullTimeRecords, lockMatch } from "../../support/convex/gameweekScoresMatch.harness";

// SPEC.md row 3's check (League rules): the same week's table differs under two leagues' League
// settings, and every league scores it by the site's set. Two leagues of three teams play the
// recorded Hull v Everton in gameweek 6; one leaves its odd team out on the league's average, the
// other on a bye. Each is made in its own deployment (scoresLeague makes one), on the same
// first scoring set.

/** The second league's odd team out: not the first rules' league average. */
const SECOND_ODD_TEAM_OUT: OddTeamOut = "bye";

/** A league of three, on the first rules but `oddTeamOut`, its gameweek 6 stored as the football
 *  sync stores it by those rules (playedFixtures.ts), and Hull v Everton played and locked. */
async function playedUnder(oddTeamOut?: OddTeamOut): Promise<ScoresLeague> {
  const league = await scoresLeague({ catToo: true });
  if (oddTeamOut !== undefined) {
    await league.t.run(async (ctx) => {
      const { leagueId } = league;
      for (const row of await ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId)).collect()) {
        await ctx.db.patch("leagueRules", row._id, { rules: { ...row.rules, oddTeamOut } });
      }
      // The harness stores gameweek 6 with Cat's team on the league's average; draw it again by these rules.
      for (const row of await ctx.db.query("playedFixtures").withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", leagueId)).collect()) {
        await ctx.db.delete("playedFixtures", row._id);
      }
      const leagueDoc = (await ctx.db.get("leagues", leagueId))!;
      await storeBegunFixtures(ctx, leagueDoc, await seasonRules(ctx, leagueId), await leagueDeadlines(ctx, leagueId), Date.now());
    });
  }
  await fullTimeRecords(league);
  await lockMatch(league);
  return league;
}

/** Each team's points in gameweek 6, who sat it out, and the table, by team name. */
async function weekOf(league: ScoresLeague) {
  const read = (await readTable(league))!;
  const result = read.results.find((each) => each.gameweek === GAMEWEEK)!;
  return {
    points: Object.fromEntries(result.teams.map(({ teamName, points }) => [teamName, points])),
    byes: read.gameweeks.find((each) => each.gameweek === GAMEWEEK)!.byes,
    table: read.table.map(({ teamName, played, won, lost, pointsFor, pointsAgainst, points }) => ({
      teamName, played, won, lost, pointsFor, pointsAgainst, points,
    })),
  };
}

test("the same week's table differs under two leagues' League settings, and every league scores it by the site's set", async () => {
  const onAverage = await weekOf(await playedUnder());
  const onBye = await weekOf(await playedUnder(SECOND_ODD_TEAM_OUT));

  // Every player scores the same in both, by the site's set: Cat's team saved no lineup, so 0.
  const points = { "Team 1": HULL_POINTS, "Team 2": EVERTON_POINTS, "Team 3": 0 };
  expect(onAverage.points).toEqual(points);
  expect(onBye.points).toEqual(points);

  // Played against the league's average, Cat's team loses to it; on a bye, the team drawn out
  // plays nobody, and Everton's side beats Cat's instead of Hull's.
  const average = inTenths((HULL_POINTS + EVERTON_POINTS + 0) / 3);
  expect(onAverage.byes).toEqual([]);
  expect(onAverage.table).toEqual([
    { teamName: "Team 2", played: 1, won: 1, lost: 0, pointsFor: EVERTON_POINTS, pointsAgainst: HULL_POINTS, points: 3 },
    { teamName: "Team 1", played: 1, won: 0, lost: 1, pointsFor: HULL_POINTS, pointsAgainst: EVERTON_POINTS, points: 0 },
    { teamName: "Team 3", played: 1, won: 0, lost: 1, pointsFor: 0, pointsAgainst: average, points: 0 },
  ]);
  expect(onBye.byes).toEqual(["Team 1"]);
  expect(onBye.table).toEqual([
    { teamName: "Team 2", played: 1, won: 1, lost: 0, pointsFor: EVERTON_POINTS, pointsAgainst: 0, points: 3 },
    { teamName: "Team 1", played: 0, won: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, points: 0 },
    { teamName: "Team 3", played: 1, won: 0, lost: 1, pointsFor: 0, pointsAgainst: EVERTON_POINTS, points: 0 },
  ]);
});
