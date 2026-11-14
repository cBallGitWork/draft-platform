import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { recordPrint } from "../../../convex/stats/livePrints";
import { countedStats } from "../../../convex/stats/seasonStats";
import { sumStats } from "../../../convex/stats/statTotals";
import { REPLAY_MINUTES, stagedGw6, stageTime, tickAt } from "../../support/convex/liveStats.harness";
import { HULL_EVERTON, KICKOFF, heldMatch, withHullEverton } from "../../support/convex/matchStats.harness";
import { seasonStartYear } from "../../../convex/shared/time";
import { pendingJobs, type TestConvex } from "../../support/convex/test.harness";
import { recordedGw6 } from "../../support/recorded/gw6.payloads";

// The live tick slimmed (#2006, stats/livePrints.ts): each minute it checks the match's records
// against one compact row and writes only the men who moved, and nothing else of theirs: season
// totals, season points and the Scouting rows wait for full time, which counts each record once.

beforeEach(() => vi.useFakeTimers());

const FULL_TIME = stageTime(REPLAY_MINUTES + 1);

const totalsHeld = async (t: TestConvex) =>
  new Map((await t.run((ctx) => ctx.db.query("playerSeasonStats").collect())).map((row) => [row.playerCode, row.stats] as const));
const printRows = (t: TestConvex) => t.run((ctx) => ctx.db.query("liveMatchPrints").collect());
/** Season points' re-pricing queued: a refresh, or the rebuild where none are kept yet (seasonPointsQueue.ts). */
const refreshJobs = async (t: TestConvex) => [
  ...(await pendingJobs(t, internal.stats.seasonPoints.refresh)),
  ...(await pendingJobs(t, internal.stats.seasonPoints.rebuild)),
];

/** Each man's held record counted once, men with nothing to count left out, as the totals keep them. */
async function countedOnce(t: TestConvex) {
  const counted = [...(await heldMatch(t)).records].map(([code, row]) => [code, sumStats([countedStats(row)])] as const);
  return new Map(counted.filter(([, stats]) => Object.keys(stats).length > 0));
}

test("a print is the same for a stat left out and one sent as 0, and moves with any stat, feed or start", () => {
  const record = { started: true, played: true, arrived: { fpl: true, pl: true }, stats: { minutes: 30, goals_scored: 1 } };
  expect(recordPrint({ ...record, stats: { goals_scored: 1, minutes: 30, assists: 0 } })).toBe(recordPrint(record));
  for (const moved of [
    { ...record, stats: { minutes: 31, goals_scored: 1 } },
    { ...record, arrived: { fpl: true, pl: false } },
    { ...record, started: false },
    { ...record, played: null },
  ]) {
    expect(recordPrint(moved)).not.toBe(recordPrint(record));
  }
});

test("live ticks move no season totals and re-price nobody; full time counts every record once and drops the compact row", async () => {
  const t = await withHullEverton();
  for (const minute of [30, 60, 90]) await tickAt(t, stageTime(minute), stagedGw6(minute));

  expect(await totalsHeld(t)).toEqual(new Map());
  expect(await refreshJobs(t)).toHaveLength(0);
  expect(await printRows(t)).toHaveLength(1);

  await tickAt(t, FULL_TIME, recordedGw6());

  expect(await totalsHeld(t)).toEqual(await countedOnce(t));
  expect(await refreshJobs(t)).not.toHaveLength(0);
  expect(await printRows(t)).toHaveLength(0);
});

test("a tick reading nobody moved writes no record and leaves the compact row's prints as they were, noting only when it read (S10.12)", async () => {
  const t = await withHullEverton();
  await tickAt(t, stageTime(30), stagedGw6(30));
  const [before] = await printRows(t);
  const records = (await heldMatch(t)).records;

  const { latest } = await tickAt(t, stageTime(30) + 1, stagedGw6(30));

  expect(latest.outcome).toMatchObject({ ok: true, matches: [{ fixtureCode: HULL_EVERTON, ok: true, inserted: 0, updated: 0, changed: [] }] });
  expect(await printRows(t)).toEqual([{ ...before, readAt: stageTime(30) + 1 }]);
  expect((await heldMatch(t)).records).toEqual(records);
});

test("a match read live before the compact row, its records already in the totals, is taken out and counted once at full time", async () => {
  const t = await withHullEverton();
  await tickAt(t, stageTime(30), stagedGw6(30));
  // As a tick before #2006 left it: no compact row, and each whole record already counted.
  const counted = await countedOnce(t);
  await t.run(async (ctx) => {
    for (const row of await ctx.db.query("liveMatchPrints").collect()) await ctx.db.delete("liveMatchPrints", row._id);
    for (const [playerCode, stats] of counted) await ctx.db.insert("playerSeasonStats", { season: seasonStartYear(KICKOFF), playerCode, stats });
  });

  await tickAt(t, stageTime(60), stagedGw6(60));
  expect([...(await totalsHeld(t)).values()].every((stats) => Object.values(stats).every((value) => value === 0))).toBe(true);

  await tickAt(t, FULL_TIME, recordedGw6());
  const once = await countedOnce(t);
  expect(new Map([...(await totalsHeld(t))].filter(([code]) => once.has(code)))).toEqual(once);
});

test("a totals rebuild while a match is live leaves it for full time to count", async () => {
  const t = await withHullEverton();
  await tickAt(t, stageTime(60), stagedGw6(60));

  await t.mutation(internal.stats.seasonStats.rebuild, { cursor: null });
  expect(await totalsHeld(t)).toEqual(new Map());

  await tickAt(t, FULL_TIME, recordedGw6());
  expect(await totalsHeld(t)).toEqual(await countedOnce(t));
});
