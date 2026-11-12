import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import {
  HULL_KEEPER,
  HULL_SCORER,
  HULL_STARTERS,
  LEAGUE_FULL_TIME_READ,
  PHILLIPS,
  holdHullAndEverton,
  scoresLeague,
  type ScoresLeague,
} from "../../support/convex/gameweekScores.harness";
import { fullTimeRecords, liveRecords } from "../../support/convex/gameweekScoresMatch.harness";
import { adjustScorersRole } from "../../support/convex/gameweekScoresFixes.harness";
import { actingAs, ANN } from "../../support/convex/leagues.harness";
import { mergedHullEverton } from "../../support/convex/matchStats.harness";

// The Squad panel's Started and Role points (#1005; spec/12 Squad; Craig, 6 Nov 2026), read through
// the Squad tab's query from Ann's Hull lineup in the recorded Hull v Everton: Phillips starts in
// goal and doesn't play, so Hull's keeper comes on for him at full time. The sums themselves:
// teamSquadSums.test.ts.

/** Hull's midfielder off the bench who played but didn't come on for Ann. */
const LEFT_ON_THE_BENCH = 608227;
const ROLE_GOAL = 2;

async function annsSquad(league: ScoresLeague) {
  const ann = await actingAs(league.t, ANN);
  const squad = await ann.query(api.squads.teamSquad.ofMyTeam, { leagueId: league.leagueId, now: LEAGUE_FULL_TIME_READ });
  return (code: number) => squad.players.find((each) => each.code === code)!;
}

async function annsLeague() {
  const league = await scoresLeague();
  await holdHullAndEverton(league);
  await adjustScorersRole(league, ROLE_GOAL);
  return league;
}

test("at full time the sub who came on has the start, never the starter he replaced, and his role's goal is his Role points", async () => {
  const league = await annsLeague();
  await fullTimeRecords(league);
  const rowOf = await annsSquad(league);

  expect(rowOf(HULL_KEEPER).started).toBe(1);
  expect(rowOf(PHILLIPS).started).toBe(0);
  expect(rowOf(LEFT_ON_THE_BENCH).started).toBe(0);
  // Every other starter played the match.
  for (const { playerCode } of HULL_STARTERS.filter(({ playerCode }) => playerCode !== PHILLIPS)) expect(rowOf(playerCode).started, `player ${playerCode}`).toBe(1);

  expect(rowOf(HULL_SCORER).rolePoints).toBe(ROLE_GOAL);
  // A bench man who stayed there got his team nothing: no Role points.
  expect(rowOf(LEFT_ON_THE_BENCH).rolePoints).toBeNull();
});

test("live, before anyone is subbed, the eleven at the deadline have the starts and the role's goal, provisionally", async () => {
  const league = await annsLeague();
  await liveRecords(league, mergedHullEverton());
  const rowOf = await annsSquad(league);

  expect(rowOf(HULL_SCORER).started).toBe(1);
  expect(rowOf(HULL_SCORER).rolePoints).toBe(ROLE_GOAL);
  expect(rowOf(HULL_KEEPER).started).toBe(0);
});
