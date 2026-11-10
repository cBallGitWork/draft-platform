import { expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { TableNames } from "../../../convex/_generated/dataModel";
import { adminByline, matchWords } from "../../../convex/mail/letterWords";
import schema from "../../../convex/schema";
import { inTenths } from "../../../convex/scoring/values";
import { refusals } from "../../../convex/shared/leagueAccess";
import { OVERRIDE_POINTS_MOST, OVERRIDE_REASON_MAX } from "../../../convex/table/overrideLimits";
import { lostPlayerName, overrideRefusals } from "../../../convex/table/pointsOverrides";
import { MINUTES_STAT } from "../../../convex/stats/matchRecords";
import {
  ANN,
  annsScoredGame,
  BOB,
  EVERTON_POINTS,
  GAMEWEEK,
  holdHullAndEverton,
  HULL_POINTS,
  HULL_SCORER,
  HULL_STARTERS,
  losePlayer,
  nameOf,
  PHILLIPS,
  readTable,
  scoresLeague,
  sideTotal,
  type ScoresLeague,
} from "../../support/convex/gameweekScores.harness";
import { fullTimeRecords, lockMatch, storeLeague } from "../../support/convex/gameweekScoresMatch.harness";
import { actingAs, ADMIN, COMMISSIONER } from "../../support/convex/leagues.harness";
import { EVERTON_CLUB, HULL_CITY, HULL_EVERTON, mergedHullEverton } from "../../support/convex/matchStats.harness";
import { EMOJI, expectRefused } from "../../support/convex/test.harness";

// A commissioner overrides one player's points for one match, with a reason (#32; spec/14, Changes
// and corrections): the table, the matchup and the stored scores all take it, and the whole league
// is told in one letter. Hull v Everton, locked and stored, Ann fielding Hull and Bob Everton.

const RECORDS = mergedHullEverton();
/** Hull's scorer's own points in the match, at the cell he starts in. */
const SCORERS_POINTS = sideTotal(RECORDS, HULL_STARTERS.filter((starter) => starter.playerCode === HULL_SCORER));
const OVERRIDDEN = 12.5;
const REASON = "The feed gave his second goal to an Everton defender";
const MATCH_NAME = matchWords(HULL_CITY.name, EVERTON_CLUB.name);
const ANNS_AFTER = inTenths(HULL_POINTS - SCORERS_POINTS + OVERRIDDEN);
/** A code no feed holds. */
const NOBODY = 999_999;

/** A league whose gameweek 6 is final and stored, Hull and Everton held by name. */
async function storedLeague(): Promise<ScoresLeague> {
  const league = await scoresLeague();
  await holdHullAndEverton(league);
  await fullTimeRecords(league);
  await lockMatch(league);
  await storeLeague(league);
  return league;
}

type Override = { playerCode?: number; points?: number; reason?: string; fixtureCode?: number };
const overrides = async ({ t, leagueId }: ScoresLeague, by: string, { playerCode = HULL_SCORER, points = OVERRIDDEN, reason = REASON, fixtureCode = HULL_EVERTON }: Override = {}) =>
  (await actingAs(t, by)).mutation(api.table.pointsOverrides.override, { leagueId, fixtureCode, playerCode, points, reason });

/** Each team's points in gameweek 6, as the table has them. */
const tablePoints = async (league: ScoresLeague) =>
  (await readTable(league))!.results.find((each) => each.gameweek === GAMEWEEK)!.teams.map(({ teamId, points }) => ({ teamId, points }));
const storedPoints = ({ t }: ScoresLeague) => t.run(async (ctx) => (await ctx.db.query("finalScores").collect()).map(({ teamId, points }) => ({ teamId, points })));
/** Ann's matchup as she sees it: her total, the opponent's, and her scorer's points. */
async function annsMatchup(league: ScoresLeague) {
  const { team, opponent } = await annsScoredGame(league);
  if (team.kind !== "team") throw new Error("Ann's side is the league's average");
  return { team: team.points, opponent: opponent.points, scorer: team.lineup!.starters.find((slot) => slot.playerCode === HULL_SCORER)!.points };
}
const lettersOf = ({ t }: ScoresLeague) => t.run((ctx) => ctx.db.query("letters").collect());

/** Every row of every table but those an override writes, without the stored scores' own ids and
 *  times, which a re-score writes afresh. */
const everythingElse = ({ t }: ScoresLeague) =>
  t.run(async (ctx) => {
    const writes: TableNames[] = ["pointsOverrides", "letters", "leagueEvents", "finalScores"];
    const rows: Record<string, unknown[]> = {};
    for (const table of Object.keys(schema.tables) as TableNames[]) if (!writes.includes(table)) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });

test("an override changes the player's points, the team's total and the head-to-head, and files one letter; nothing else moves", async () => {
  const league = await storedLeague();
  const before = await everythingElse(league);
  const annsTeamName = (await league.t.run((ctx) => ctx.db.get("teams", league.annsTeam)))!.name;
  const lettersBefore = (await lettersOf(league)).length;

  await overrides(league, COMMISSIONER);
  expect(await everythingElse(league)).toEqual(before);

  const expected = [
    { teamId: league.annsTeam, points: ANNS_AFTER },
    { teamId: league.bobsTeam, points: EVERTON_POINTS },
  ];
  expect(await tablePoints(league)).toEqual(expected);
  expect(await storedPoints(league)).toEqual(expected);
  expect(await annsMatchup(league)).toEqual({ team: ANNS_AFTER, opponent: EVERTON_POINTS, scorer: OVERRIDDEN });

  const name = await nameOf(league, HULL_SCORER);
  const letters = (await lettersOf(league)).slice(lettersBefore);
  expect(letters.map((letter) => letter.to).toSorted()).toEqual([ANN, BOB, COMMISSIONER].toSorted());
  for (const letter of letters) {
    expect(letter.subject).toBe(`${name}'s points in ${MATCH_NAME} were overridden`);
    expect(letter.body).toBe(
      `${COMMISSIONER} overrode ${name}'s points in ${MATCH_NAME}, gameweek ${GAMEWEEK}: ${SCORERS_POINTS} to ${OVERRIDDEN}. ` +
        `Why: ${REASON}\n\n${annsTeamName} now have ${ANNS_AFTER} in gameweek ${GAMEWEEK}, not ${HULL_POINTS}.`,
    );
  }
});

test("a second override of the same man in the same match replaces the first, and its letter says from what", async () => {
  const league = await storedLeague();
  await overrides(league, COMMISSIONER);
  await overrides(league, COMMISSIONER, { points: SCORERS_POINTS, reason: "Put back: the feed was right" });

  const rows = await league.t.run((ctx) => ctx.db.query("pointsOverrides").collect());
  expect(rows.map(({ points, reason }) => ({ points, reason }))).toEqual([{ points: SCORERS_POINTS, reason: "Put back: the feed was right" }]);
  expect(await tablePoints(league)).toEqual([
    { teamId: league.annsTeam, points: HULL_POINTS },
    { teamId: league.bobsTeam, points: EVERTON_POINTS },
  ]);
  const last = (await lettersOf(league)).at(-1)!;
  expect(last.body).toContain(`: ${OVERRIDDEN} to ${SCORERS_POINTS}. Why: Put back: the feed was right`);
  expect(last.body).toContain(`now have ${HULL_POINTS} in gameweek ${GAMEWEEK}, not ${ANNS_AFTER}.`);
});

test("overriding a man whose points don't count moves no total, and the letter says so", async () => {
  const league = await storedLeague();
  // Phillips started but didn't play: Hull's keeper came on for him.
  await overrides(league, ADMIN, { playerCode: PHILLIPS, points: 3 });

  expect(await tablePoints(league)).toEqual([
    { teamId: league.annsTeam, points: HULL_POINTS },
    { teamId: league.bobsTeam, points: EVERTON_POINTS },
  ]);
  const last = (await lettersOf(league)).at(-1)!;
  expect(last.body).toMatch(new RegExp(`^${adminByline} overrode .*: 0 to 3\\. Why: ${REASON}\\n\\nNo team's total moved: no lineup counted him\\.$`));
});

test("a manager who doesn't run the league is refused, and nothing changes", async () => {
  const league = await storedLeague();
  const before = await tablePoints(league);

  await expectRefused(overrides(league, ANN), refusals.notRunner);
  expect(await league.t.run((ctx) => ctx.db.query("pointsOverrides").collect())).toEqual([]);
  expect(await tablePoints(league)).toEqual(before);
});

test("an override is refused with a reason when it can't be sound", async () => {
  const league = await storedLeague();
  const attempt = (override: Override) => overrides(league, COMMISSIONER, override);

  await expectRefused(attempt({ reason: "  " }), overrideRefusals.blankReason);
  await expectRefused(attempt({ reason: "x".repeat(OVERRIDE_REASON_MAX + 1) }), overrideRefusals.reasonTooLong);
  await expectRefused(attempt({ fixtureCode: NOBODY }), overrideRefusals.noMatch);
  await expectRefused(attempt({ playerCode: NOBODY }), refusals.noPlayer);
  await expectRefused(attempt({ points: 0.05 }), overrideRefusals.notPoints);
  await expectRefused(attempt({ points: Number.POSITIVE_INFINITY }), overrideRefusals.notPoints);
  await expectRefused(attempt({ points: OVERRIDE_POINTS_MOST + 1 }), overrideRefusals.outOfRange);
  await expectRefused(attempt({ points: -OVERRIDE_POINTS_MOST - 1 }), overrideRefusals.outOfRange);
  expect(overrideRefusals.outOfRange).toBe(`An override is from −${OVERRIDE_POINTS_MOST} to ${OVERRIDE_POINTS_MOST} points.`);
  // A man of a club not in the match, and named on neither sheet.
  await league.t.run((ctx) => ctx.db.insert("players", { code: NOBODY, name: "Elsewhere", fullName: "Elsewhere", clubCode: 1 }));
  await expectRefused(attempt({ playerCode: NOBODY }), overrideRefusals.notInMatch("Elsewhere"));
  expect(await league.t.run((ctx) => ctx.db.query("pointsOverrides").collect())).toEqual([]);
});

test("an override of exactly the most points either way is let in", async () => {
  const league = await storedLeague();
  await overrides(league, COMMISSIONER, { points: OVERRIDE_POINTS_MOST });
  await overrides(league, COMMISSIONER, { points: -OVERRIDE_POINTS_MOST });

  expect((await league.t.run((ctx) => ctx.db.query("pointsOverrides").collect())).map((row) => row.points)).toEqual([-OVERRIDE_POINTS_MOST]);
});

test(`a reason of ${OVERRIDE_REASON_MAX} characters is let in when each is an emoji, two UTF-16 units apiece`, async () => {
  const league = await storedLeague();
  const reason = EMOJI.repeat(OVERRIDE_REASON_MAX);
  await overrides(league, COMMISSIONER, { reason });

  expect((await league.t.run((ctx) => ctx.db.query("pointsOverrides").collect())).map((row) => ({ points: row.points, reason: row.reason }))).toEqual([
    { points: OVERRIDDEN, reason },
  ]);
  await expectRefused(overrides(league, COMMISSIONER, { reason: reason + EMOJI }), overrideRefusals.reasonTooLong);
});

test("a match still inside its corrections window can be overridden, and the override stands over a later correction (S14.2, S14.4)", async () => {
  const league = await scoresLeague();
  await holdHullAndEverton(league);
  await fullTimeRecords(league);
  await overrides(league, COMMISSIONER);
  expect((await annsMatchup(league)).scorer).toBe(OVERRIDDEN);

  // The feed takes his goal away: everything but his minutes goes.
  await fullTimeRecords(league, RECORDS.map((record) => (record.playerCode === HULL_SCORER ? { ...record, stats: { [MINUTES_STAT]: record.stats[MINUTES_STAT] } } : record)));
  expect(await annsMatchup(league)).toEqual({ team: ANNS_AFTER, opponent: EVERTON_POINTS, scorer: OVERRIDDEN });
  await lockMatch(league);
  await storeLeague(league);
  expect(await tablePoints(league)).toEqual([
    { teamId: league.annsTeam, points: ANNS_AFTER },
    { teamId: league.bobsTeam, points: EVERTON_POINTS },
  ]);
});

const removes = async ({ t, leagueId }: ScoresLeague, by: string, playerCode = HULL_SCORER) =>
  (await actingAs(t, by)).mutation(api.table.pointsOverrides.removeOverride, { leagueId, fixtureCode: HULL_EVERTON, playerCode });

test("removing an override puts his scored points back everywhere, and the league is told (S14.5)", async () => {
  const league = await storedLeague();
  const annsTeamName = (await league.t.run((ctx) => ctx.db.get("teams", league.annsTeam)))!.name;
  await overrides(league, COMMISSIONER);
  await removes(league, ADMIN);

  expect(await league.t.run((ctx) => ctx.db.query("pointsOverrides").collect())).toEqual([]);
  const scored = [
    { teamId: league.annsTeam, points: HULL_POINTS },
    { teamId: league.bobsTeam, points: EVERTON_POINTS },
  ];
  expect(await tablePoints(league)).toEqual(scored);
  expect(await storedPoints(league)).toEqual(scored);
  expect(await annsMatchup(league)).toEqual({ team: HULL_POINTS, opponent: EVERTON_POINTS, scorer: SCORERS_POINTS });

  const name = await nameOf(league, HULL_SCORER);
  const last = (await lettersOf(league)).at(-1)!;
  expect(last.subject).toBe(`${name}'s override in ${MATCH_NAME} was removed`);
  expect(last.body).toBe(
    `${adminByline} removed the override of ${name}'s points in ${MATCH_NAME}, gameweek ${GAMEWEEK}: ${OVERRIDDEN} to ${SCORERS_POINTS}, as scored.\n\n` +
      `${annsTeamName} now have ${HULL_POINTS} in gameweek ${GAMEWEEK}, not ${ANNS_AFTER}.`,
  );
});

test("removing an override is refused where none is held, or by a manager who doesn't run the league", async () => {
  const league = await storedLeague();
  const name = await nameOf(league, HULL_SCORER);
  await expectRefused(removes(league, COMMISSIONER), overrideRefusals.noOverride(name));
  await overrides(league, COMMISSIONER);
  await expectRefused(removes(league, ANN), refusals.notRunner);
  expect(await league.t.run((ctx) => ctx.db.query("pointsOverrides").collect())).toHaveLength(1);
});

test("a man the football data has lost can be overridden in a match he has a saved record in, and his points count again (#810, S14.5)", async () => {
  const league = await storedLeague();
  await losePlayer(league, HULL_SCORER);
  await league.t.mutation(internal.table.finalScores.rescore, { leagueId: league.leagueId, gameweek: GAMEWEEK });
  const lost = await tablePoints(league);
  expect(lost).not.toEqual([
    { teamId: league.annsTeam, points: HULL_POINTS },
    { teamId: league.bobsTeam, points: EVERTON_POINTS },
  ]);

  await overrides(league, COMMISSIONER);
  expect(await tablePoints(league)).toEqual([
    { teamId: league.annsTeam, points: ANNS_AFTER },
    { teamId: league.bobsTeam, points: EVERTON_POINTS },
  ]);
  expect((await lettersOf(league)).at(-1)!.subject).toBe(`${lostPlayerName(HULL_SCORER)}'s points in ${MATCH_NAME} were overridden`);

  await removes(league, COMMISSIONER);
  expect(await tablePoints(league)).toEqual(lost);
});

test("his card shows the override on the match, with why, to anyone in the league", async () => {
  const league = await storedLeague();
  await overrides(league, COMMISSIONER);

  const card = await (await actingAs(league.t, BOB)).query(api.playerCard.playerCard.card, { leagueId: league.leagueId, playerCode: HULL_SCORER, now: Date.now() });
  expect(card!.matches.map(({ fixtureCode, override }) => ({ fixtureCode, override }))).toEqual([
    { fixtureCode: HULL_EVERTON, override: { points: OVERRIDDEN, reason: REASON } },
  ]);
});
