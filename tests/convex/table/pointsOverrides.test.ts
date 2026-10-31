import { ConvexError } from "convex/values";
import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { TableNames } from "../../../convex/_generated/dataModel";
import { adminByline, matchWords } from "../../../convex/mail/letterWords";
import schema from "../../../convex/schema";
import { inTenths } from "../../../convex/scoring/values";
import { refusals } from "../../../convex/shared/leagueAccess";
import { OVERRIDE_POINTS_MOST, OVERRIDE_REASON_MAX } from "../../../convex/table/overrideLimits";
import { overrideRefusals } from "../../../convex/table/pointsOverrides";
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
import { EMOJI } from "../../support/convex/test.harness";

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

const refusalOf = async (call: Promise<unknown>) => {
  try {
    await call;
  } catch (error) {
    if (error instanceof ConvexError) return error.data as string;
    throw error;
  }
  return null;
};

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

  expect(await refusalOf(overrides(league, ANN))).toBe(refusals.notRunner);
  expect(await league.t.run((ctx) => ctx.db.query("pointsOverrides").collect())).toEqual([]);
  expect(await tablePoints(league)).toEqual(before);
});

test("an override is refused with a reason when it can't be sound", async () => {
  const league = await storedLeague();
  const refusalFor = (override: Override) => refusalOf(overrides(league, COMMISSIONER, override));

  expect(await refusalFor({ reason: "  " })).toBe(overrideRefusals.blankReason);
  expect(await refusalFor({ reason: "x".repeat(OVERRIDE_REASON_MAX + 1) })).toBe(overrideRefusals.reasonTooLong);
  expect(await refusalFor({ fixtureCode: NOBODY })).toBe(overrideRefusals.noMatch);
  expect(await refusalFor({ playerCode: NOBODY })).toBe(refusals.noPlayer);
  expect(await refusalFor({ points: 0.05 })).toBe(overrideRefusals.notPoints);
  expect(await refusalFor({ points: Number.POSITIVE_INFINITY })).toBe(overrideRefusals.notPoints);
  expect(await refusalFor({ points: OVERRIDE_POINTS_MOST + 1 })).toBe(overrideRefusals.outOfRange);
  expect(await refusalFor({ points: -OVERRIDE_POINTS_MOST - 1 })).toBe(overrideRefusals.outOfRange);
  expect(overrideRefusals.outOfRange).toBe(`An override is from −${OVERRIDE_POINTS_MOST} to ${OVERRIDE_POINTS_MOST} points.`);
  // A man of a club not in the match, and named on neither sheet.
  await league.t.run((ctx) => ctx.db.insert("players", { code: NOBODY, name: "Elsewhere", fullName: "Elsewhere", clubCode: 1 }));
  expect(await refusalFor({ playerCode: NOBODY })).toBe(overrideRefusals.notInMatch("Elsewhere"));
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
  expect(await refusalOf(overrides(league, COMMISSIONER, { reason: reason + EMOJI }))).toBe(overrideRefusals.reasonTooLong);
});

test("a match still inside its corrections window can't be overridden: its own corrections still move it", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);

  expect(await refusalOf(overrides(league, COMMISSIONER))).toBe(overrideRefusals.notLocked);
});

test("his card shows the override on the match, with why, to anyone in the league", async () => {
  const league = await storedLeague();
  await overrides(league, COMMISSIONER);

  const card = await (await actingAs(league.t, BOB)).query(api.playerCard.playerCard.card, { leagueId: league.leagueId, playerCode: HULL_SCORER, now: Date.now() });
  expect(card!.matches.map(({ fixtureCode, override }) => ({ fixtureCode, override }))).toEqual([
    { fixtureCode: HULL_EVERTON, override: { points: OVERRIDDEN, reason: REASON } },
  ]);
});
