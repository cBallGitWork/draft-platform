import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { TIMED_JOBS_SETTING } from "../../../convex/outbound/deploymentSettings";
import { LIVE_WINDOW_MS } from "../../../convex/shared/dueMatches";
import { LINEUPS_OUT_BEFORE_KICKOFF_MS, MINUTE_MS } from "../../../convex/shared/time";
import { stagedGw6, stageTime, tickAt } from "../../support/convex/liveStats.harness";
import { KICKOFF, withHullEverton } from "../../support/convex/matchStats.harness";
import { pendingJobs, type TestConvex } from "../../support/convex/test.harness";

// The live ticks run only near matches (#1999, the Convex quota): no cron calls them each minute
// (crons.test.ts), so a week with no match costs no tick at all. A sync arms the chain at the next
// match's window, and each tick schedules the next a minute on while it had a match to read. As
// every timed feed, it is off on development (S20.8).

beforeEach(() => vi.useFakeTimers());

const SHEETS_OPEN = KICKOFF - LINEUPS_OUT_BEFORE_KICKOFF_MS;
const ticksDue = async (t: TestConvex) => (await pendingJobs(t, internal.stats.liveStatsSync.tick)).map((job) => job.scheduledTime);
const armFromSync = (t: TestConvex) => t.mutation(internal.stats.liveTicks.arrange, { feed: "liveStats", ranTick: false, busy: null });

test("a sync arms one tick, at the hour before the next kickoff, however often it runs", async () => {
  const t = await withHullEverton();
  vi.setSystemTime(KICKOFF - 2 * 24 * 60 * MINUTE_MS);

  await armFromSync(t);
  await armFromSync(t);
  expect(await ticksDue(t)).toEqual([SHEETS_OPEN]);
});

test("a kickoff moved earlier moves the armed tick with it", async () => {
  const t = await withHullEverton();
  vi.setSystemTime(KICKOFF - 2 * 24 * 60 * MINUTE_MS);
  await armFromSync(t);

  const earlier = KICKOFF - 24 * 60 * MINUTE_MS;
  await t.run(async (ctx) => ctx.db.patch("fixtures", (await ctx.db.query("fixtures").unique())!._id, { kickoff: earlier }));
  await armFromSync(t);
  expect(await ticksDue(t)).toEqual([earlier - LINEUPS_OUT_BEFORE_KICKOFF_MS]);
});

test("a tick before any window reads nothing and sleeps until the team sheets' hour", async () => {
  const t = await withHullEverton();

  const { fetch } = await tickAt(t, SHEETS_OPEN - MINUTE_MS, stagedGw6(0));
  expect(fetch).not.toHaveBeenCalled();
  expect(await ticksDue(t)).toEqual([SHEETS_OPEN]);
});

test("while a match is live, each tick schedules the next a minute on", async () => {
  const t = await withHullEverton();

  await tickAt(t, stageTime(29), stagedGw6(29));
  expect(await ticksDue(t)).toEqual([stageTime(29) + MINUTE_MS]);
});

test("with no match left to come, a tick schedules nothing", async () => {
  const t = await withHullEverton();

  await tickAt(t, KICKOFF + LIVE_WINDOW_MS, stagedGw6(0));
  expect(await ticksDue(t)).toEqual([]);
  expect(await t.run((ctx) => ctx.db.query("liveTickChains").collect())).toEqual([]);
});

test("where timed jobs are off, nothing arms the tick", async () => {
  vi.stubEnv(TIMED_JOBS_SETTING, "");
  const t = await withHullEverton();
  vi.setSystemTime(SHEETS_OPEN - MINUTE_MS);

  await armFromSync(t);
  expect(await ticksDue(t)).toEqual([]);
});

test("where Sportmonks' token isn't set, its tick is never armed", async () => {
  const t = await withHullEverton();

  await t.mutation(internal.stats.liveTicks.arrange, { feed: "sportmonksLive", ranTick: false, busy: null });
  expect(await pendingJobs(t, internal.football.sportmonks.sportmonksLive.tick)).toEqual([]);
});
