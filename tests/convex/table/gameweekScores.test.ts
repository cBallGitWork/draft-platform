import { expect, test } from "vitest";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { mergedHullEverton } from "../../support/convex/matchStats.harness";
import { silenceConsoleError } from "../../support/convex/test.harness";
import {
  EVERTON_STARTERS,
  fullTimeRecords,
  GAMEWEEK,
  HULL_AFTER_SUB,
  HULL_SCORER,
  HULL_STARTERS,
  liveRecords,
  lockMatch,
  readTable,
  scoresLeague,
  sideTotal,
  type ScoresLeague,
} from "../../support/convex/gameweekScores.harness";

// The table's scores (#29, #28, #287): each team's lineup in a gameweek begun, auto-subs from who
// played, then its points under the site's scoring set, into the head-to-head table; live points
// move it, provisional until the match locks; a gameweek that can't be scored is named, not blank.

const RECORDS = mergedHullEverton();
/** Hull's points once the match is over, their keeper on for Phillips, and Everton's: each the sum
 *  of its eleven's FPL lines in golden/hull-everton.scores.json, area by area. Pinned as well as
 *  worked out player by player, so a change in how a match scores shows here. */
const HULL_POINTS = 26;
const EVERTON_POINTS = 38;

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

test("a starter who didn't play is replaced by the first on the bench who can play his slot, and the sub's points count", async () => {
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
  const [rule] = FIRST_SCORING.rules;
  await league.t.run((ctx) =>
    ctx.db.insert("siteScoring", {
      scoring: { ...FIRST_SCORING, rules: [...FIRST_SCORING.rules, { ...rule, stat: "goals_scroed" }] },
      kind: "fix",
      season: 2026,
      number: 1,
      announcedAt: 0,
      takesEffectAt: 0,
    }),
  );
  const logged = silenceConsoleError();

  const read = (await readTable(league))!;
  expect(read.unscored).toEqual([{ gameweek: GAMEWEEK, reason: expect.stringContaining('"goals_scroed"') }]);
  expect(read.results).toEqual([]);
  expect(read.table.every((row) => row.played === 0)).toBe(true);
  expect(read.gameweeks.find((each) => each.gameweek === GAMEWEEK)!.fixtures[0].points).toBeNull();
  expect(logged).toHaveBeenCalledWith(expect.stringContaining(`can't score gameweek ${GAMEWEEK}`));
});
