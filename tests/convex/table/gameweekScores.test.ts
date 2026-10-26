import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { actingAs } from "../../support/convex/leagues.harness";
import { inTenths } from "../../../convex/scoring/scoringSet";
import { mergedHullEverton } from "../../support/convex/matchStats.harness";
import { silenceConsoleError } from "../../support/convex/test.harness";
import {
  ANN,
  EVERTON_POINTS,
  EVERTON_STARTERS,
  fullTimeRecords,
  GAMEWEEK,
  holdTypoRule,
  HULL_AFTER_SUB,
  HULL_POINTS,
  HULL_SCORER,
  HULL_STARTERS,
  liveRecords,
  lockMatch,
  readTable,
  scoresLeague,
  sideTotal,
  TYPO_STAT,
  type ScoresLeague,
} from "../../support/convex/gameweekScores.harness";

// The table's scores (#29, #28, #287): each team's lineup in a gameweek begun, auto-subs from who
// played, then its points under the site's scoring set, into the head-to-head table; live points
// move it, provisional until the match locks; a gameweek that can't be scored is named, not blank.

const RECORDS = mergedHullEverton();

/** Each team's result in gameweek 6, by name. */
async function gameweek6(league: ScoresLeague) {
  const read = (await readTable(league))!;
  const result = read.results.find((each) => each.gameweek === GAMEWEEK);
  const teams = new Map(result?.teams.map(({ teamName, ...team }) => [teamName, team]));
  return { read, ann: teams.get("Team 1"), bob: teams.get("Team 2") };
}

test("a gameweek replayed from the recorded match gives each team its points, the head-to-head result and the table", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);

  const { read, ann, bob } = await gameweek6(league);
  expect(sideTotal(RECORDS, HULL_AFTER_SUB)).toBe(HULL_POINTS);
  expect(sideTotal(RECORDS, EVERTON_STARTERS)).toBe(EVERTON_POINTS);
  expect(ann).toEqual({ teamId: league.annsTeam, points: HULL_POINTS, provisional: false, noLineup: false });
  expect(bob).toEqual({ teamId: league.bobsTeam, points: EVERTON_POINTS, provisional: false, noLineup: false });
  expect(read.unscored).toEqual([]);

  const fixtures = read.gameweeks.find((each) => each.gameweek === GAMEWEEK)!.fixtures;
  expect(fixtures).toEqual([{ team: "Team 1", opponent: "Team 2", points: { team: HULL_POINTS, opponent: EVERTON_POINTS } }]);
  expect(read.table.map(({ teamName, played, won, drawn, lost, pointsFor, pointsAgainst, difference, points }) => ({
    teamName, played, won, drawn, lost, pointsFor, pointsAgainst, difference, points,
  }))).toEqual([
    { teamName: "Team 2", played: 1, won: 1, drawn: 0, lost: 0, pointsFor: EVERTON_POINTS, pointsAgainst: HULL_POINTS, difference: EVERTON_POINTS - HULL_POINTS, points: 3 },
    { teamName: "Team 1", played: 1, won: 0, drawn: 0, lost: 1, pointsFor: HULL_POINTS, pointsAgainst: EVERTON_POINTS, difference: HULL_POINTS - EVERTON_POINTS, points: 0 },
  ]);
  // The other gameweeks haven't begun, so none of theirs is scored.
  expect(read.results.map((each) => each.gameweek)).toEqual([GAMEWEEK]);
  expect(read.gameweeks.filter((each) => each.gameweek !== GAMEWEEK).every((each) => each.fixtures.every((fixture) => fixture.points === null))).toBe(true);
});

test("a starter who didn't play is subbed once his match is over, and the sub's points count in his place", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  const { ann } = await gameweek6(league);
  // Phillips, an unused substitute, scores nothing in goal; Hull's keeper played the 90.
  expect(ann?.points).toBe(sideTotal(RECORDS, HULL_AFTER_SUB));
  expect(ann?.points).not.toBe(sideTotal(RECORDS, HULL_STARTERS));
});

test("live points move as the records arrive, provisional until the match locks, then final", async () => {
  const league = await scoresLeague();
  // At an hour in, Hull's goal not yet scored: the match isn't over, so Phillips still stands in goal.
  const beforeTheGoal = RECORDS.map((record) =>
    record.playerCode === HULL_SCORER ? { ...record, stats: { ...record.stats, goals_scored: 0 } } : record,
  );
  await liveRecords(league, beforeTheGoal);
  const live = await gameweek6(league);
  expect(live.ann).toMatchObject({ points: sideTotal(beforeTheGoal, HULL_STARTERS), provisional: true });
  expect(live.bob).toMatchObject({ points: EVERTON_POINTS, provisional: true });

  await fullTimeRecords(league);
  const fullTime = await gameweek6(league);
  // Still inside the corrections window: the goal and the keeper's sub count, provisionally.
  expect(fullTime.ann).toMatchObject({ points: HULL_POINTS, provisional: true });
  expect(fullTime.ann!.points).toBeGreaterThan(live.ann!.points);

  await lockMatch(league);
  const final = await gameweek6(league);
  expect(final.ann).toMatchObject({ points: HULL_POINTS, provisional: false });
  expect(final.bob).toMatchObject({ points: EVERTON_POINTS, provisional: false });
});

test("a team that never saved a lineup scores 0, marked so a screen can say why", async () => {
  const league = await scoresLeague({ bobSaves: false });
  await fullTimeRecords(league);
  await lockMatch(league);
  const { read, bob } = await gameweek6(league);
  expect(bob).toEqual({ teamId: league.bobsTeam, points: 0, provisional: false, noLineup: true });
  expect(read.table[0]).toMatchObject({ teamName: "Team 1", won: 1, points: 3 });
});

test("a site set holding a rule on a stat that doesn't exist leaves the gameweek out, named with the reason, and logged (#287)", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await holdTypoRule(league);
  const logged = silenceConsoleError();

  const read = (await readTable(league))!;
  expect(read.unscored).toEqual([{ gameweek: GAMEWEEK, reason: expect.stringContaining(`"${TYPO_STAT}"`) }]);
  expect(read.results).toEqual([]);
  expect(read.table.every((row) => row.played === 0)).toBe(true);
  expect(read.gameweeks.find((each) => each.gameweek === GAMEWEEK)!.fixtures[0].points).toBeNull();
  expect(logged).toHaveBeenCalledWith(expect.stringContaining(`can't score gameweek ${GAMEWEEK}`));
});

test("the team left over plays the league's average, every team's score counted once in it", async () => {
  const league = await scoresLeague({ catToo: true });
  await fullTimeRecords(league);
  await lockMatch(league);
  const read = (await readTable(league))!;

  // Cat's team saved no lineup, so it scores 0 and counts in the average as 0.
  const average = inTenths((HULL_POINTS + EVERTON_POINTS + 0) / 3);
  const fixtures = read.gameweeks.find((each) => each.gameweek === GAMEWEEK)!.fixtures;
  expect(fixtures).toContainEqual({ team: "Team 3", opponent: null, points: { team: 0, opponent: average } });
  expect(read.table.find((row) => row.teamName === "Team 3")).toMatchObject({ played: 1, lost: 1, pointsFor: 0, pointsAgainst: average });
});

test("a total-points league has each team's gameweek in its results, and ranks by points for", async () => {
  const league = await scoresLeague();
  await league.t.run(async (ctx) => {
    for (const row of await ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", league.leagueId)).collect()) {
      await ctx.db.patch("leagueRules", row._id, { rules: { ...row.rules, format: "totalPoints" } });
    }
  });
  await fullTimeRecords(league);
  await lockMatch(league);

  const { read, ann, bob } = await gameweek6(league);
  expect(read.format).toBe("totalPoints");
  expect([ann?.points, bob?.points]).toEqual([HULL_POINTS, EVERTON_POINTS]);
  expect(read.table.map(({ teamName, played, points }) => ({ teamName, played, points }))).toEqual([
    { teamName: "Team 2", played: 1, points: EVERTON_POINTS },
    { teamName: "Team 1", played: 1, points: HULL_POINTS },
  ]);
});

test("league home's table and form read the same scores as the table", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  const home = await (await actingAs(league.t, ANN)).query(api.home.leagueHome.ofLeague, { leagueId: league.leagueId, now: Date.now() });

  expect(home!.table.map(({ teamName, played, won, lost, points, form }) => ({ teamName, played, won, lost, points, form }))).toEqual([
    { teamName: "Team 2", played: 1, won: 1, lost: 0, points: 3, form: ["won"] },
    { teamName: "Team 1", played: 1, won: 0, lost: 1, points: 0, form: ["lost"] },
  ]);
});
