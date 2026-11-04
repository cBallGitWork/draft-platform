import { expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { PING_FAILED_LOG, PING_URL_ENV, scheduleHeartbeat, withHeartbeat } from "../../../convex/heartbeats/heartbeat";
import { freshConvex, pendingJobs, silenceConsoleError } from "../../support/convex/test.harness";

// The timed jobs' heartbeats to Healthchecks.io (docs/PLAN.md, "No monitoring"): a ping when a
// job finishes, a failure ping when it throws, and nothing at all with no ping address set.

const BASE = "https://hc-ping.com/ping-key";

/** A fetch that answers every ping with `status`, recording each URL. */
function pings(status = 200) {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

test("with no ping address set, a job runs and nothing is pinged or scheduled", async () => {
  vi.stubEnv(PING_URL_ENV, "");
  const fetch = pings();
  await expect(withHeartbeat("footballSync", async () => "done")).resolves.toBe("done");
  const t = freshConvex();
  await t.run((ctx) => scheduleHeartbeat(ctx, "pruneRunLogs"));
  expect(await pendingJobs(t)).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
});

test("a job that finishes pings its own check; a run by hand pings nothing", async () => {
  vi.stubEnv(PING_URL_ENV, `${BASE}/`);
  const fetch = pings();
  await withHeartbeat("liveStatsTick", async () => null);
  await withHeartbeat(null, async () => null);
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([`${BASE}/live-stats-tick`]);
});

test("a job that throws pings its check's failure, and still throws", async () => {
  vi.stubEnv(PING_URL_ENV, BASE);
  const fetch = pings();
  await expect(
    withHeartbeat("lateStats", async () => {
      throw new Error("the read broke");
    }),
  ).rejects.toThrow("the read broke");
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([`${BASE}/late-stats/fail`]);
});

test("a ping Healthchecks refuses is logged and never fails the job", async () => {
  vi.stubEnv(PING_URL_ENV, BASE);
  pings(503);
  const logged = silenceConsoleError();
  await expect(withHeartbeat("footballSync", async () => null)).resolves.toBeNull();
  expect(logged).toHaveBeenCalledWith(PING_FAILED_LOG, "footballSync", 503);
});

/** The pings among everything a job fetched. */
const pinged = (fetch: ReturnType<typeof pings>) => fetch.mock.calls.map(([url]) => url).filter((url) => url.startsWith(BASE));

test("each sync pings its check when the cron runs it, and not when it's run by hand", async () => {
  vi.stubEnv(PING_URL_ENV, BASE);
  const fetch = pings();
  const t = freshConvex();
  // The football sync's read of an empty faked feed fails, and is logged.
  silenceConsoleError();
  await t.action(internal.football.footballSync.run, { trigger: "manual" });
  await t.action(internal.stats.matchStatsSync.run, { trigger: "manual" });
  expect(pinged(fetch)).toEqual([]);
  await t.action(internal.football.footballSync.run, { trigger: "cron" });
  await t.action(internal.stats.matchStatsSync.run, { trigger: "cron" });
  await t.action(internal.stats.liveStatsSync.tick, {});
  expect(pinged(fetch)).toEqual([`${BASE}/football-sync`, `${BASE}/late-stats`, `${BASE}/live-stats-tick`]);
});

test("the daily clean-up pings once its last run log is pruned", async () => {
  vi.stubEnv(PING_URL_ENV, BASE);
  const fetch = pings();
  vi.useFakeTimers();
  const t = freshConvex();
  await t.mutation(internal.admin.runLogs.prune, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([`${BASE}/prune-run-logs`]);
});
