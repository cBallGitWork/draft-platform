import { expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import { silenceConsoleError } from "../../support/convex/test.harness";
import { actingAs, addManagers, COMMISSIONER } from "../../support/convex/leagues.harness";
import { HULL_EVERTON } from "../../support/convex/matchStats.harness";
import {
  CAT,
  EVERTON_POINTS,
  fullTimeRecords,
  GAMEWEEK,
  holdTypoRule,
  HULL_POINTS,
  HULL_SCORER,
  TYPO_STAT,
  lockMatch,
  readTable,
  scoresLeague,
  storeLeague,
  writeOverAnns,
  WRITTEN_OVER,
  type ScoresLeague,
} from "../../support/convex/gameweekScores.harness";

// Storing a gameweek's scores once final (#418): every match in it locked, each team's points are
// stored and read from then on, so the table never scores the whole season on each read. A gameweek
// not yet final is still worked out live; `rescore` stores one again.

/** A match the football sync moves into gameweek 6 after it was stored, between two clubs no
 *  squad here holds. */
const MOVED_IN = 999_001;
const OTHER_CLUBS = [901, 902] as const;
const finalRows = ({ t }: ScoresLeague) => t.run((ctx) => ctx.db.query("finalScores").collect());
/** Each stored row's team and points, in team order, and whether it is marked as never having
 *  saved a lineup, which no row has been since #637. */
const stored = async (league: ScoresLeague) =>
  (await finalRows(league)).map(({ gameweek, teamId, points, noLineup }) => ({ gameweek, teamId, points, noLineup }));
/** Ann's points in gameweek 6 as the table reads them. */
const annsPoints = async (league: ScoresLeague) =>
  (await readTable(league))!.results.find((each) => each.gameweek === GAMEWEEK)!.teams.find((team) => team.teamId === league.annsTeam);

test("once the match locks, each team's points are stored, and the table reads them from then on", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);

  expect(await storeLeague(league)).toEqual([GAMEWEEK]);
  expect(await stored(league)).toEqual([
    { gameweek: GAMEWEEK, teamId: league.annsTeam, points: HULL_POINTS, noLineup: undefined },
    { gameweek: GAMEWEEK, teamId: league.bobsTeam, points: EVERTON_POINTS, noLineup: undefined },
  ]);
  await writeOverAnns(league);
  expect(await annsPoints(league)).toMatchObject({ points: WRITTEN_OVER, provisional: false });
  // Stored once: a second ask stores nothing more.
  expect(await storeLeague(league)).toEqual([]);
});

test("a row stored before #637 for a team that had never saved a lineup is read as stored: 0, marked so the table says why", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  await storeLeague(league);
  await league.t.run(async (ctx) => {
    const bobs = (await ctx.db.query("finalScores").collect()).find((row) => row.teamId === league.bobsTeam)!;
    await ctx.db.patch("finalScores", bobs._id, { points: 0, noLineup: true });
  });
  const bob = (await readTable(league))!.results.find((each) => each.gameweek === GAMEWEEK)!.teams.find((team) => team.teamId === league.bobsTeam);
  expect(bob).toMatchObject({ points: 0, provisional: false, noLineup: true });
});

test("a starter released after the deadline is in the stored score: it freezes the squad at the deadline (#415)", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await (await actingAs(league.t, COMMISSIONER)).mutation(api.squads.squads.release, { leagueId: league.leagueId, playerCode: HULL_SCORER });
  await lockMatch(league);

  expect(await storeLeague(league)).toEqual([GAMEWEEK]);
  expect((await stored(league)).map(({ points }) => points)).toEqual([HULL_POINTS, EVERTON_POINTS]);
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

test("a team added after a gameweek was stored is worked out alone and stored beside the rest, which stay as stored", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  await storeLeague(league);
  await writeOverAnns(league);
  const [catsTeam] = await addManagers(league.t, league.leagueId, [CAT]);

  expect(await annsPoints(league)).toMatchObject({ points: WRITTEN_OVER, provisional: false });
  expect(await storeLeague(league)).toEqual([GAMEWEEK]);
  expect(await stored(league)).toEqual([
    { gameweek: GAMEWEEK, teamId: league.annsTeam, points: WRITTEN_OVER, noLineup: undefined },
    { gameweek: GAMEWEEK, teamId: league.bobsTeam, points: EVERTON_POINTS, noLineup: undefined },
    { gameweek: GAMEWEEK, teamId: catsTeam, points: 0, noLineup: undefined },
  ]);
});

/** A match between two clubs no squad here holds, put in gameweek 6 as the football sync would. */
const holdOtherMatch = ({ t }: ScoresLeague) =>
  t.run((ctx) =>
    ctx.db.insert("fixtures", { code: MOVED_IN, gameweek: GAMEWEEK, homeClubCode: OTHER_CLUBS[0], awayClubCode: OTHER_CLUBS[1], kickoff: Date.now() }),
  );
/** That match read at full time, its window passed and locked. */
const lockOtherMatch = ({ t }: ScoresLeague) =>
  t.run((ctx) => ctx.db.insert("matchStatsStatus", { fixtureCode: MOVED_IN, state: "locked", fullTimeAt: Date.now(), lockedAt: Date.now(), lastReadAt: Date.now() }));
const storedCodes = async (league: ScoresLeague) => (await finalRows(league)).map((row) => row.fixtureCodes.toSorted());

test("a match moved into a stored gameweek reopens it: worked out live, then stored afresh once that match locks", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  await storeLeague(league);
  await writeOverAnns(league);
  await holdOtherMatch(league);

  expect(await annsPoints(league)).toMatchObject({ points: HULL_POINTS });
  // Not final while the moved match hasn't locked, so nothing is stored over the old rows yet.
  expect(await storeLeague(league)).toEqual([]);

  await lockOtherMatch(league);
  expect(await storeLeague(league)).toEqual([GAMEWEEK]);
  expect((await stored(league)).map(({ points }) => points)).toEqual([HULL_POINTS, EVERTON_POINTS]);
  expect(await storedCodes(league)).toEqual([[HULL_EVERTON, MOVED_IN].toSorted(), [HULL_EVERTON, MOVED_IN].toSorted()]);
});

test("a match moved out of a stored gameweek reopens it, and it is stored afresh from the matches left", async () => {
  const league = await scoresLeague();
  await holdOtherMatch(league);
  await lockOtherMatch(league);
  await fullTimeRecords(league);
  await lockMatch(league);
  await storeLeague(league);
  await writeOverAnns(league);
  await league.t.run(async (ctx) => {
    const moved = (await ctx.db.query("fixtures").collect()).find((fixture) => fixture.code === MOVED_IN)!;
    await ctx.db.patch("fixtures", moved._id, { gameweek: GAMEWEEK + 1 });
  });

  expect(await annsPoints(league)).toMatchObject({ points: HULL_POINTS, provisional: false });
  expect(await storeLeague(league)).toEqual([GAMEWEEK]);
  expect(await storedCodes(league)).toEqual([[HULL_EVERTON], [HULL_EVERTON]]);
});

test("rows of one gameweek that disagree on its matches count as none, and it is stored afresh", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  await storeLeague(league);
  await writeOverAnns(league);
  await league.t.run(async (ctx) => {
    const bobs = (await ctx.db.query("finalScores").collect()).find((row) => row.teamId === league.bobsTeam)!;
    await ctx.db.patch("finalScores", bobs._id, { fixtureCodes: [MOVED_IN] });
  });

  expect(await annsPoints(league)).toMatchObject({ points: HULL_POINTS });
  expect(await storeLeague(league)).toEqual([GAMEWEEK]);
  expect(await storedCodes(league)).toEqual([[HULL_EVERTON], [HULL_EVERTON]]);
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
