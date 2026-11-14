import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { CRON_TRIGGER, PING_URL_ENV } from "../../../convex/heartbeats/heartbeat";
import { TIMED_JOBS_SETTING } from "../../../convex/outbound/deploymentSettings";
import { waiverLeague } from "../../support/convex/waivers.harness";
import { freshConvex, pendingJobs, silenceConsoleError, type TestConvex } from "../../support/convex/test.harness";

// The timed jobs off on development (#1997, S20.8): where TIMED_JOBS_ON is unset, each feed, waiver
// and trade job's cron entry reads no feed, schedules nothing and writes no row, so development
// spends none of the free plan's database reads on them. A run by hand still runs. Each test's
// "on" half is the same job on the live site, for the reads the flag removes.

const BASE = "https://hc-ping.com/ping-key";
/** 06:00 UK in winter, when the daily positions cron starts its run. */
const DAILY_RUN_AT = "2026-11-10T06:00:00Z";

let fetch: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv(PING_URL_ENV, BASE);
  fetch = vi.fn(async (_url: string) => new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetch);
});

const jobsOff = () => vi.stubEnv(TIMED_JOBS_SETTING, "");
const fetched = () => fetch.mock.calls.map(([url]) => url as string);
const runRows = (t: TestConvex) =>
  t.run(async (ctx) => [
    ...(await ctx.db.query("footballSyncs").collect()),
    ...(await ctx.db.query("matchStatsSyncs").collect()),
    ...(await ctx.db.query("liveStatsTicks").collect()),
  ]);

test("off: the football sync, late stats and the live tick fetch nothing and write no run row when their cron starts them", async () => {
  jobsOff();
  const t = freshConvex();
  await t.action(internal.football.footballSync.run, { trigger: CRON_TRIGGER });
  await t.action(internal.stats.matchStatsSync.run, { trigger: CRON_TRIGGER });
  await t.action(internal.stats.liveStatsSync.tick, {});
  expect(fetched()).toEqual([]);
  expect(await runRows(t)).toEqual([]);
});

test("on, as on the live site: the same crons read and write their run rows and ping", async () => {
  // Held, so the failure email the football sync schedules never fires into the next test; at the
  // top of an hour, when the minutely and 10-minute jobs ping (#2002).
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse(DAILY_RUN_AT));
  const t = freshConvex();
  // The football sync's read of an empty faked feed fails, and is logged.
  silenceConsoleError();
  await t.action(internal.football.footballSync.run, { trigger: CRON_TRIGGER });
  await t.action(internal.stats.matchStatsSync.run, { trigger: CRON_TRIGGER });
  await t.action(internal.stats.liveStatsSync.tick, {});
  expect(fetched().length).toBeGreaterThan(3);
  // The football sync's row; late stats with nothing due write none (#2002), nor does a tick with no match live.
  expect((await runRows(t)).length).toBe(1);
});

test("off: a sync run by hand still runs", async () => {
  jobsOff();
  vi.useFakeTimers();
  const t = freshConvex();
  silenceConsoleError();
  await t.action(internal.football.footballSync.run, { trigger: "manual" });
  expect(await runRows(t)).toHaveLength(1);
});

test("off: the daily positions cron starts no run; on, it starts one", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse(DAILY_RUN_AT));
  const off = freshConvex();
  jobsOff();
  await off.mutation(internal.positions.positionsSync.daily, {});
  expect(await pendingJobs(off)).toEqual([]);

  vi.unstubAllEnvs();
  const on = freshConvex();
  await on.mutation(internal.positions.positionsSync.daily, {});
  expect(await pendingJobs(on, internal.positions.positionsSync.run)).toHaveLength(1);
});

test("off: the waiver and trade checks ask no league for anything and ping nothing; on, they do", async () => {
  vi.useFakeTimers();
  const { t } = await waiverLeague();
  const before = (await pendingJobs(t)).length;
  jobsOff();
  await t.mutation(internal.waivers.waiverRun.runDue, {});
  await t.mutation(internal.trades.tradeClose.closeDue, {});
  expect(await pendingJobs(t)).toHaveLength(before);

  vi.unstubAllEnvs();
  vi.stubEnv(PING_URL_ENV, BASE);
  await t.mutation(internal.waivers.waiverRun.runDue, {});
  await t.mutation(internal.trades.tradeClose.closeDue, {});
  expect(await pendingJobs(t, internal.waivers.waiverRun.runLeagueDue)).toHaveLength(1);
  expect((await pendingJobs(t, internal.heartbeats.heartbeat.beat)).map((job) => job.args)).toEqual([[{ check: "waiverRuns" }], [{ check: "tradeOffers" }]]);
});
