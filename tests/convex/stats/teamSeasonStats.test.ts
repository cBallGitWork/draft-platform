import { expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { PlayerMatchRecord } from "../../../convex/stats/matchRecords";
import { sumStats, type Stats } from "../../../convex/stats/statTotals";
import { HULL_EVERTON, mergedHullEverton } from "../../support/convex/matchStats.harness";
import { addManagers } from "../../support/convex/leagues.harness";
import {
  CAT,
  EVERTON_STARTERS,
  fullTimeRecords,
  GAMEWEEK,
  HULL_AFTER_SUB,
  HULL_KEEPER,
  HULL_STARTERS,
  HULL_SCORER,
  lockMatch,
  scoresLeague,
  type ScoresLeague,
} from "../../support/convex/gameweekScores.harness";
import { BELLOUMI } from "../../support/convex/teamPoints.harness";

// The stat race's totals (#800, spec/19 The stat race): each team's season stats, counting only its
// starters and the bench players who came on, added in once a gameweek is final and moved when a
// gameweek reopens or is stored again. Replayed from the recorded Hull v Everton: Ann fields Hull
// with their unused substitute keeper in goal, so their keeper comes on for him, and Belloumi, who
// came on at 64 and scored, stays on Ann's bench, his starters all having played.

const RECORDS = mergedHullEverton();

/** The stats of these men's records added up, as the test works them out by hand. */
function statsOf(records: readonly PlayerMatchRecord[], codes: readonly number[]): Stats {
  const byCode = new Map(records.map((record) => [record.playerCode, record]));
  return sumStats(codes.map((code) => byCode.get(code)!.stats));
}
const codesOf = (starters: readonly { playerCode: number }[]) => starters.map((starter) => starter.playerCode);

const storeStats = ({ t, leagueId }: ScoresLeague) => t.mutation(internal.stats.teamSeasonStats.storeLeague, { leagueId });
const totalsOf = async ({ t }: ScoresLeague, teamId: Id<"teams">) =>
  (await t.run((ctx) => ctx.db.query("teamSeasonStats").collect())).find((row) => row.teamId === teamId)?.stats;
const shares = ({ t }: ScoresLeague) => t.run((ctx) => ctx.db.query("teamGameweekStats").collect());

/** A match the football sync moves into gameweek 6 after it was stored, between two clubs no squad
 *  here holds. */
const MOVED_IN = 999_001;
const holdMovedIn = ({ t }: ScoresLeague) =>
  t.run((ctx) => ctx.db.insert("fixtures", { code: MOVED_IN, gameweek: GAMEWEEK, homeClubCode: 901, awayClubCode: 902, kickoff: Date.now() }));
const lockMovedIn = ({ t }: ScoresLeague) =>
  t.run((ctx) => ctx.db.insert("matchStatsStatus", { fixtureCode: MOVED_IN, state: "locked", fullTimeAt: Date.now(), lockedAt: Date.now(), lastReadAt: Date.now() }));

test("once the gameweek is final, each team's totals are its counted players' stats added up, and a bench player who stayed on adds nothing", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);

  expect(await storeStats(league)).toEqual([GAMEWEEK]);
  const ann = await totalsOf(league, league.annsTeam);
  expect(ann).toEqual(statsOf(RECORDS, codesOf(HULL_AFTER_SUB)));
  expect(await totalsOf(league, league.bobsTeam)).toEqual(statsOf(RECORDS, codesOf(EVERTON_STARTERS)));
  // Belloumi's goal is Hull's second: the record has two, Ann's totals only Gelhardt's.
  expect(statsOf(RECORDS, [BELLOUMI]).goals_scored).toBe(1);
  expect(ann!.goals_scored).toBe(statsOf(RECORDS, [HULL_SCORER]).goals_scored);
  // The keeper who came on counts: his saves are in, which Hull's eleven as named would leave out.
  expect(ann).not.toEqual(statsOf(RECORDS, codesOf(HULL_STARTERS)));
  expect(statsOf(RECORDS, [HULL_KEEPER]).saves).toBeGreaterThan(0);
  expect(ann!.saves).toBe(statsOf(RECORDS, [HULL_KEEPER]).saves);
});

test("inside the corrections window nothing is added, and a correction made in it is what the totals hold once final", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  expect(await storeStats(league)).toEqual([]);
  expect(await shares(league)).toEqual([]);

  const corrected = RECORDS.map((record) => (record.playerCode === HULL_SCORER ? { ...record, stats: { ...record.stats, goals_scored: 0 } } : record));
  await fullTimeRecords(league, corrected);
  await lockMatch(league);
  await storeStats(league);

  expect(await totalsOf(league, league.annsTeam)).toEqual(statsOf(corrected, codesOf(HULL_AFTER_SUB)));
  expect((await totalsOf(league, league.annsTeam))!.goals_scored).toBeUndefined();
});

test("storing again adds nothing twice", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  await storeStats(league);
  const once = await totalsOf(league, league.annsTeam);

  expect(await storeStats(league)).toEqual([]);
  expect(await totalsOf(league, league.annsTeam)).toEqual(once);
});

test("the lock itself asks every league to store its teams' stats", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  await league.t.finishAllScheduledFunctions(vi.runAllTimers);

  expect(await totalsOf(league, league.annsTeam)).toEqual(statsOf(RECORDS, codesOf(HULL_AFTER_SUB)));
});

test("a match moved into a stored gameweek takes its share away until the gameweek is final again, then adds it back", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  await storeStats(league);
  await holdMovedIn(league);

  expect(await storeStats(league)).toEqual([GAMEWEEK]);
  expect(await totalsOf(league, league.annsTeam)).toEqual({});
  expect(await shares(league)).toEqual([]);

  await lockMovedIn(league);
  expect(await storeStats(league)).toEqual([GAMEWEEK]);
  expect(await totalsOf(league, league.annsTeam)).toEqual(statsOf(RECORDS, codesOf(HULL_AFTER_SUB)));
  expect((await shares(league)).map((share) => share.fixtureCodes.toSorted())).toEqual([
    [HULL_EVERTON, MOVED_IN].toSorted(),
    [HULL_EVERTON, MOVED_IN].toSorted(),
  ]);
});

test("a share stored from other matches is stored again, the totals moved by the difference, not added twice", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  await storeStats(league);
  await league.t.run(async (ctx) => {
    const anns = (await ctx.db.query("teamGameweekStats").collect()).find((row) => row.teamId === league.annsTeam)!;
    await ctx.db.patch("teamGameweekStats", anns._id, { fixtureCodes: [MOVED_IN] });
  });

  expect(await storeStats(league)).toEqual([GAMEWEEK]);
  expect(await totalsOf(league, league.annsTeam)).toEqual(statsOf(RECORDS, codesOf(HULL_AFTER_SUB)));
});

test("rebuild sets every total afresh from the gameweeks, whatever was held", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  await storeStats(league);
  await league.t.run(async (ctx) => {
    const anns = (await ctx.db.query("teamSeasonStats").collect()).find((row) => row.teamId === league.annsTeam)!;
    await ctx.db.patch("teamSeasonStats", anns._id, { stats: { goals_scored: 99 } });
  });

  await league.t.mutation(internal.stats.teamSeasonStats.rebuild, { leagueId: league.leagueId });
  await league.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await totalsOf(league, league.annsTeam)).toEqual(statsOf(RECORDS, codesOf(HULL_AFTER_SUB)));
  expect(await totalsOf(league, league.bobsTeam)).toEqual(statsOf(RECORDS, codesOf(EVERTON_STARTERS)));
  expect(await shares(league)).toHaveLength(2);
});

test("a gameweek left provisional after the lock by a feed's gap stores nothing, and a share from other matches comes off meanwhile", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  await storeStats(league);
  await league.t.run(async (ctx) => {
    const anns = (await ctx.db.query("teamGameweekStats").collect()).find((row) => row.teamId === league.annsTeam)!;
    await ctx.db.patch("teamGameweekStats", anns._id, { fixtureCodes: [MOVED_IN] });
    const scorer = (await ctx.db.query("playerMatchStats").collect()).find((row) => row.playerCode === HULL_SCORER)!;
    await ctx.db.patch("playerMatchStats", scorer._id, { arrived: { fpl: true, pl: false } });
  });

  expect(await storeStats(league)).toEqual([GAMEWEEK]);
  expect(await totalsOf(league, league.annsTeam)).toEqual({});
  expect((await shares(league)).map((share) => share.teamId)).toEqual([league.bobsTeam]);
});

test("a team added after a gameweek was stored has its own share worked out, the others' left as they were", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  await storeStats(league);
  const [catsTeam] = await addManagers(league.t, league.leagueId, [CAT]);

  expect(await storeStats(league)).toEqual([GAMEWEEK]);
  expect((await shares(league)).find((share) => share.teamId === catsTeam)?.stats).toEqual({});
  expect(await totalsOf(league, catsTeam)).toBeUndefined();
  expect(await totalsOf(league, league.annsTeam)).toEqual(statsOf(RECORDS, codesOf(HULL_AFTER_SUB)));
});
