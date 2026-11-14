import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { HOUR_MS } from "../../../convex/shared/time";
import { ANN, CAT } from "../../support/convex/leagues.harness";
import { GAMEWEEK, HULL_SCORER, homeAt, LEAGUE_FULL_TIME_READ, LEAGUE_KICKOFF, matchupAs, nameOf, readTable, scoresLeague, type ScoresLeague } from "../../support/convex/gameweekScores.harness";
import { fullTimeRecords, lockMatch, WRITTEN_OVER } from "../../support/convex/gameweekScoresMatch.harness";
import { holdLines, storedLine } from "../../support/convex/matchPage.harness";
import { elapse } from "../../support/convex/test.harness";

// The live gameweek scored once a tick (#2007, convex/table/liveScores.ts): while a match is on,
// Table, Home, the matchday Vidiprinter and the matchup's league average read one small row the
// tick writes, so a viewer's read no longer scores the league from every record of every match.
// Ann (Hull) plays Bob (Everton) in gameweek 6's one match; Cat, with nobody in her lineup, plays
// the league's average.

beforeEach(() => vi.useFakeTimers());

/** The league at full time, with a goal by Hull's scorer in the commentary. */
async function liveLeague(): Promise<ScoresLeague> {
  const league = await scoresLeague({ catToo: true });
  await fullTimeRecords(league);
  await holdLines(league, [storedLine(2, `64' GOAL ${await nameOf(league, HULL_SCORER)}`, 64, "goal", [HULL_SCORER]), storedLine(1, "KO HUL v EVE", 0, "start")]);
  return league;
}

/** The live tick's scoring of the league's gameweek 6. */
const tickScores = ({ t, leagueId }: ScoresLeague) => t.mutation(internal.table.liveScores.scoreLeague, { leagueId, gameweeks: [GAMEWEEK] });

const liveRow = ({ t, leagueId }: ScoresLeague) =>
  t.run((ctx) => ctx.db.query("liveScores").withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", leagueId).eq("gameweek", GAMEWEEK)).unique());

/** Ann's points in the live row written over with one no team made, to tell a read of the row
 *  from a gameweek worked out. */
async function writeOverAnnsLive(league: ScoresLeague) {
  const row = (await liveRow(league))!;
  if (row.teams.kind !== "scored") throw new Error(`the live row isn't scored: ${JSON.stringify(row.teams)}`);
  const scores = row.teams.scores.map((each) => (each.teamId === league.annsTeam ? { ...each, points: WRITTEN_OVER } : each));
  await league.t.run((ctx) => ctx.db.patch("liveScores", row._id, { teams: { kind: "scored", scores } }));
}

const annsResult = async (league: ScoresLeague) =>
  (await readTable(league)).results.find((result) => result.gameweek === GAMEWEEK)!.teams.find((team) => team.teamId === league.annsTeam)!.points;

/** Everything a manager sees of the gameweek: the table, league home with its matchday open, and
 *  Ann's and Cat's matchups. */
const screens = async (league: ScoresLeague) => ({
  table: await readTable(league),
  home: await homeAt(league, LEAGUE_FULL_TIME_READ + HOUR_MS),
  anns: await matchupAs(league, ANN, { gameweek: GAMEWEEK }),
  cats: await matchupAs(league, CAT, { gameweek: GAMEWEEK }),
});

test("a manager sees the same table, home, Vidiprinter and matchups from the tick's row as from the gameweek worked out", async () => {
  const league = await liveLeague();
  const workedOut = await screens(league);
  await tickScores(league);
  expect(await liveRow(league)).not.toBeNull();
  expect(await screens(league)).toEqual(workedOut);
  // The Vidiprinter holds the goal, priced, from the row.
  expect(workedOut.home!.matchday?.commentary).toMatchObject({ kind: "read", lines: [{ text: expect.stringContaining("GOAL") }] });
});

test("with the row held, the table reads it and no record: a record changed behind it moves nothing until the next tick", async () => {
  const league = await liveLeague();
  await tickScores(league);
  const before = await annsResult(league);
  // Every record of Ann's men written to nothing, with no tick: the screens don't read them.
  await league.t.run(async (ctx) => {
    for (const row of await ctx.db.query("playerMatchStats").collect()) await ctx.db.patch("playerMatchStats", row._id, { stats: {} });
  });
  expect(await annsResult(league)).toBe(before);
  await tickScores(league);
  expect(await annsResult(league)).not.toBe(before);
});

test("home's head-to-head and the table show the row's points while it stands for the league's teams and the gameweek's matches", async () => {
  const league = await liveLeague();
  await tickScores(league);
  await writeOverAnnsLive(league);
  expect(await annsResult(league)).toBe(WRITTEN_OVER);
  expect((await homeAt(league, LEAGUE_FULL_TIME_READ))!.thisGameweek?.fixtures[0].points?.team).toBe(WRITTEN_OVER);

  // A match moved out of the gameweek since sets the row aside: the gameweek is worked out again.
  const row = (await liveRow(league))!;
  await league.t.run((ctx) => ctx.db.patch("liveScores", row._id, { fixtureCodes: [...row.fixtureCodes, 999_001] }));
  expect(await annsResult(league)).not.toBe(WRITTEN_OVER);
});

test("the match locking between ticks scores the row again: final, never left provisional (S07.2)", async () => {
  const league = await liveLeague();
  await tickScores(league);
  await writeOverAnnsLive(league);
  await lockMatch(league);
  await elapse(league.t, 0);
  const row = (await liveRow(league))!;
  expect(row.teams.kind === "scored" && row.teams.scores.every((team) => !team.provisional && team.points !== WRITTEN_OVER)).toBe(true);
  expect((await readTable(league)).results[0].teams.every((team) => !team.provisional)).toBe(true);
});

test("once no match is live, the tick clears every row, and the screens work the gameweek out again", async () => {
  const league = await liveLeague();
  await tickScores(league);
  await writeOverAnnsLive(league);
  vi.setSystemTime(LEAGUE_KICKOFF + 24 * HOUR_MS);
  await league.t.action(internal.stats.liveStatsSync.tick, {});
  await elapse(league.t, 0);
  expect(await liveRow(league)).toBeNull();
  expect(await annsResult(league)).not.toBe(WRITTEN_OVER);
});
