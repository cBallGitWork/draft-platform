import { ConvexError } from "convex/values";
import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { refusals } from "../../../convex/shared/leagueAccess";
import { TEAM_OVERRIDE_POINTS_MOST } from "../../../convex/table/overrideLimits";
import { overrideRefusals } from "../../../convex/table/pointsOverrides";
import { teamOverrideRefusals } from "../../../convex/table/teamOverrides";
import {
  ANN,
  annsScoredGame,
  EVERTON_POINTS,
  GAMEWEEK,
  holdHullAndEverton,
  HULL_POINTS,
  HULL_SCORER,
  readTable,
  scoresLeague,
  type ScoresLeague,
} from "../../support/convex/gameweekScores.harness";
import { fullTimeRecords, lockMatch, storeLeague } from "../../support/convex/gameweekScoresMatch.harness";
import { actingAs, ADMIN, COMMISSIONER } from "../../support/convex/leagues.harness";
import { HULL_EVERTON } from "../../support/convex/matchStats.harness";

// A commissioner sets a team's total in a gameweek, with a reason (#903; spec/14 S14.2-S14.5):
// the head-to-head and the table follow it, it stands over the gameweek's player overrides and a
// later correction, "remove override" puts the scored total back, and the league is told each
// time. Hull v Everton in gameweek 6, Ann fielding Hull (24) and Bob Everton (32), so Bob wins as
// scored.

/** Enough to turn Ann's loss into a win. */
const SET = 40;
const REASON = "Two subs the auto-subs missed";

async function storedLeague(): Promise<ScoresLeague> {
  const league = await scoresLeague();
  await holdHullAndEverton(league);
  await fullTimeRecords(league);
  await lockMatch(league);
  await storeLeague(league);
  return league;
}

type TeamOverride = { gameweek?: number; teamId?: Id<"teams">; points?: number; reason?: string };
const overridesTeam = async (league: ScoresLeague, by: string, { gameweek = GAMEWEEK, teamId = league.annsTeam, points = SET, reason = REASON }: TeamOverride = {}) =>
  (await actingAs(league.t, by)).mutation(api.table.teamOverrides.overrideTeam, { leagueId: league.leagueId, gameweek, teamId, points, reason });
const removesTeam = async (league: ScoresLeague, by: string) =>
  (await actingAs(league.t, by)).mutation(api.table.teamOverrides.removeTeamOverride, { leagueId: league.leagueId, gameweek: GAMEWEEK, teamId: league.annsTeam });

/** Ann's and Bob's points in gameweek 6 and Ann's wins, as the table has them, the stored totals,
 *  and the matchup's score as Ann sees it. */
async function everywhere(league: ScoresLeague) {
  const table = (await readTable(league))!;
  const { team, opponent } = await annsScoredGame(league);
  const stored = await league.t.run((ctx) => ctx.db.query("finalScores").collect());
  return {
    table: table.results.find((each) => each.gameweek === GAMEWEEK)!.teams.map(({ points }) => points),
    annWon: table.table.find((row) => row.teamId === league.annsTeam)!.won,
    stored: stored.map(({ points }) => points),
    matchup: [team.points, opponent.points],
  };
}
const teamNameOf = async ({ t, annsTeam }: ScoresLeague) => (await t.run((ctx) => ctx.db.get("teams", annsTeam)))!.name;
const lastLetter = async ({ t }: ScoresLeague) => (await t.run((ctx) => ctx.db.query("letters").collect())).at(-1)!;

const refusalOf = async (call: Promise<unknown>) => {
  try {
    await call;
  } catch (error) {
    if (error instanceof ConvexError) return error.data as string;
    throw error;
  }
  return null;
};

test("a team's override sets its gameweek total: the head-to-head, the table and the stored score follow, and the league is told why (S14.3)", async () => {
  const league = await storedLeague();
  expect((await everywhere(league)).annWon).toBe(0);

  await overridesTeam(league, COMMISSIONER);
  expect(await everywhere(league)).toEqual({ table: [SET, EVERTON_POINTS], annWon: 1, stored: [SET, EVERTON_POINTS], matchup: [SET, EVERTON_POINTS] });

  const name = await teamNameOf(league);
  const letter = await lastLetter(league);
  expect(letter.subject).toBe(`${name}'s total in gameweek ${GAMEWEEK} was overridden`);
  expect(letter.body).toBe(`${COMMISSIONER} overrode ${name}'s total in gameweek ${GAMEWEEK}: ${HULL_POINTS} to ${SET}. Why: ${REASON}`);
});

test("a team's override stands over a player override in its gameweek (S14.4)", async () => {
  const league = await storedLeague();
  await overridesTeam(league, COMMISSIONER);
  await (await actingAs(league.t, COMMISSIONER)).mutation(api.table.pointsOverrides.override, {
    leagueId: league.leagueId,
    fixtureCode: HULL_EVERTON,
    playerCode: HULL_SCORER,
    points: 50,
    reason: "A hat-trick the feed missed",
  });

  expect((await everywhere(league)).table).toEqual([SET, EVERTON_POINTS]);
});

test("a gameweek still open can be overridden, and the override stands over its corrections (S14.2, S14.4)", async () => {
  const league = await scoresLeague();
  await holdHullAndEverton(league);
  await fullTimeRecords(league);
  await overridesTeam(league, COMMISSIONER);

  const { team } = await annsScoredGame(league);
  expect(team.points).toBe(SET);
  await fullTimeRecords(league);
  await lockMatch(league);
  await storeLeague(league);
  expect((await everywhere(league)).table).toEqual([SET, EVERTON_POINTS]);
});

test("removing a team's override puts its scored total back everywhere, and the league is told (S14.5)", async () => {
  const league = await storedLeague();
  await overridesTeam(league, COMMISSIONER);
  await overridesTeam(league, ADMIN, { points: SET + 1 });
  expect(await league.t.run((ctx) => ctx.db.query("teamOverrides").collect())).toHaveLength(1);
  await removesTeam(league, ADMIN);

  expect(await league.t.run((ctx) => ctx.db.query("teamOverrides").collect())).toEqual([]);
  expect(await everywhere(league)).toEqual({ table: [HULL_POINTS, EVERTON_POINTS], annWon: 0, stored: [HULL_POINTS, EVERTON_POINTS], matchup: [HULL_POINTS, EVERTON_POINTS] });
  const name = await teamNameOf(league);
  const letter = await lastLetter(league);
  expect(letter.subject).toBe(`${name}'s override in gameweek ${GAMEWEEK} was removed`);
  expect(letter.body).toBe(`The admin removed the override of ${name}'s total in gameweek ${GAMEWEEK}: ${SET + 1} to ${HULL_POINTS}, as scored.`);
});

test("a team's override is refused with a reason when it can't be sound, and nothing changes", async () => {
  const league = await storedLeague();
  const refusalFor = (override: TeamOverride, by = COMMISSIONER) => refusalOf(overridesTeam(league, by, override));

  expect(await refusalFor({}, ANN)).toBe(refusals.notRunner);
  expect(await refusalFor({ reason: " " })).toBe(overrideRefusals.blankReason);
  expect(await refusalFor({ gameweek: GAMEWEEK + 1 })).toBe(overrideRefusals.notBegun(GAMEWEEK + 1));
  expect(await refusalFor({ points: 0.05 })).toBe(overrideRefusals.notPoints);
  expect(await refusalFor({ points: TEAM_OVERRIDE_POINTS_MOST + 1 })).toBe(teamOverrideRefusals.outOfRange);
  expect(await refusalOf(removesTeam(league, COMMISSIONER))).toBe(teamOverrideRefusals.noOverride(await teamNameOf(league), GAMEWEEK));
  expect(await league.t.run((ctx) => ctx.db.query("teamOverrides").collect())).toEqual([]);
  expect((await everywhere(league)).table).toEqual([HULL_POINTS, EVERTON_POINTS]);
});
