import { expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { silenceConsoleError } from "../../support/convex/test.harness";
import { addManagers } from "../../support/convex/leagues.harness";
import {
  CAT,
  EVERTON_POINTS,
  fullTimeRecords,
  GAMEWEEK,
  holdTypoRule,
  HULL_POINTS,
  TYPO_STAT,
  lockMatch,
  readTable,
  scoresLeague,
  type ScoresLeague,
} from "../../support/convex/gameweekScores.harness";

// Storing a gameweek's scores once final (#418): every match in it locked, each team's points are
// stored and read from then on, so the table never scores the whole season on each read. A gameweek
// not yet final is still worked out live; `rescore` stores one again.

/** A score no team made, written over a stored one to tell a stored read from a worked-out one. */
const WRITTEN_OVER = 99;

const storeLeague = ({ t, leagueId }: ScoresLeague) => t.mutation(internal.table.finalScores.storeLeague, { leagueId });
const finalRows = ({ t }: ScoresLeague) => t.run((ctx) => ctx.db.query("finalScores").collect());
/** Each stored row's team and points, in team order. */
const stored = async (league: ScoresLeague) =>
  (await finalRows(league)).map(({ gameweek, teamId, points, noLineup }) => ({ gameweek, teamId, points, noLineup }));
/** Ann's points in gameweek 6 as the table reads them. */
const annsPoints = async (league: ScoresLeague) =>
  (await readTable(league))!.results.find((each) => each.gameweek === GAMEWEEK)!.teams.find((team) => team.teamId === league.annsTeam);
/** Ann's stored row says WRITTEN_OVER. */
const writeOverAnns = (league: ScoresLeague) =>
  league.t.run(async (ctx) => {
    const row = (await ctx.db.query("finalScores").collect()).find((each) => each.teamId === league.annsTeam)!;
    await ctx.db.patch("finalScores", row._id, { points: WRITTEN_OVER });
  });

test("once the match locks, each team's points are stored, and the table reads them from then on", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);

  expect(await storeLeague(league)).toEqual([GAMEWEEK]);
  expect(await stored(league)).toEqual([
    { gameweek: GAMEWEEK, teamId: league.annsTeam, points: HULL_POINTS, noLineup: false },
    { gameweek: GAMEWEEK, teamId: league.bobsTeam, points: EVERTON_POINTS, noLineup: false },
  ]);
  await writeOverAnns(league);
  expect(await annsPoints(league)).toMatchObject({ points: WRITTEN_OVER, provisional: false });
  // Stored once: a second ask stores nothing more.
  expect(await storeLeague(league)).toEqual([]);
});

test("the lock itself asks every league to store what it made final", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  await league.t.finishAllScheduledFunctions(vi.runAllTimers);

  expect((await stored(league)).map(({ points }) => points)).toEqual([HULL_POINTS, EVERTON_POINTS]);
});

test("inside the corrections window nothing is stored, and the table works the points out live", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);

  expect(await storeLeague(league)).toEqual([]);
  expect(await finalRows(league)).toEqual([]);
  expect(await annsPoints(league)).toMatchObject({ points: HULL_POINTS, provisional: true });
});

test("a gameweek with no match held is never final, so a match moved into it later still counts", async () => {
  const league = await scoresLeague();
  await league.t.run(async (ctx) => {
    for (const row of await ctx.db.query("fixtures").collect()) await ctx.db.delete("fixtures", row._id);
  });

  expect(await storeLeague(league)).toEqual([]);
  expect(await annsPoints(league)).toMatchObject({ points: 0, provisional: false });
});

test("a team added after a gameweek was stored has the gameweek worked out again, then stored again with it", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  await storeLeague(league);
  await writeOverAnns(league);
  const [catsTeam] = await addManagers(league.t, league.leagueId, [CAT]);

  // Worked out, not read: Ann's points are hers again, not the stored row's.
  expect(await annsPoints(league)).toMatchObject({ points: HULL_POINTS, provisional: false });
  expect(await storeLeague(league)).toEqual([GAMEWEEK]);
  expect(await stored(league)).toEqual([
    { gameweek: GAMEWEEK, teamId: league.annsTeam, points: HULL_POINTS, noLineup: false },
    { gameweek: GAMEWEEK, teamId: league.bobsTeam, points: EVERTON_POINTS, noLineup: false },
    { gameweek: GAMEWEEK, teamId: catsTeam, points: 0, noLineup: true },
  ]);
});

test("rescore drops a gameweek's stored points and stores them again from the records", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  await storeLeague(league);
  await writeOverAnns(league);

  expect(await league.t.mutation(internal.table.finalScores.rescore, { leagueId: league.leagueId, gameweek: GAMEWEEK })).toBe(true);
  expect((await stored(league)).map(({ points }) => points)).toEqual([HULL_POINTS, EVERTON_POINTS]);
  expect(await annsPoints(league)).toMatchObject({ points: HULL_POINTS, provisional: false });
});

test("a gameweek that can't be scored is stored for nobody, logged, and named on the table (#287)", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  await holdTypoRule(league);
  const logged = silenceConsoleError();

  expect(await storeLeague(league)).toEqual([]);
  expect(await finalRows(league)).toEqual([]);
  expect(logged).toHaveBeenCalledWith(expect.stringContaining(`can't score gameweek ${GAMEWEEK}`));
  expect((await readTable(league))!.unscored).toEqual([{ gameweek: GAMEWEEK, reason: expect.stringContaining(`"${TYPO_STAT}"`) }]);
});
