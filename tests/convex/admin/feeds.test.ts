// The feeds page's feeds (#35; spec/15 The admin): when each last arrived, and whether it is late,
// failing, not running yet or run only by hand. A feed that stops silently is the failure to catch.

import { expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import { lateAfterMs, FEED_SCHEDULES, FEEDS } from "../../../convex/shared/feedSchedule";
import { RUNS_READ } from "../../../convex/admin/feeds";
import { refusals } from "../../../convex/shared/leagueAccess";
import { HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import { ADMIN, COMMISSIONER, actingAs } from "../../support/convex/leagues.harness";
import { feedAt, feedsAt, holdMatch, holdStatus, recordRun, T0 } from "../../support/convex/feeds.harness";
import { syncRun } from "../../support/convex/footballSync.harness";
import { recordedFpl } from "../../support/recorded/fpl.payloads";
import { freshConvex } from "../../support/convex/test.harness";

const FOOTBALL_LATE_AFTER = lateAfterMs(FEED_SCHEDULES.football);
const LIVE_LATE_AFTER = lateAfterMs(FEED_SCHEDULES.liveStats);
const MATCH_STATS_LATE_AFTER = lateAfterMs(FEED_SCHEDULES.matchStats);

test("the page is the admin's alone", async () => {
  const t = freshConvex();
  vi.stubEnv("ADMIN_EMAIL", ADMIN);
  const commissioner = await actingAs(t, COMMISSIONER);
  await expect(commissioner.query(api.admin.feeds.feeds, { now: T0 })).rejects.toThrow(refusals.notAdmin);
});

test("with no run on record, every feed is not running yet", async () => {
  const report = await feedsAt(freshConvex(), T0);
  expect(report.feeds.map(({ feed, state, lastRunAt }) => ({ feed, state, lastRunAt }))).toEqual(
    FEEDS.map((feed) => ({ feed, state: "notRunningYet", lastRunAt: null })),
  );
});

test("a football sync that stops is late once its schedule's interval passes with no success, and fine up to then", async () => {
  vi.useFakeTimers({ now: T0 });
  const t = freshConvex();
  const { ranAt } = await syncRun(t, recordedFpl(), undefined, "cron");

  expect(await feedAt(t, "football", ranAt + FOOTBALL_LATE_AFTER)).toMatchObject({ state: "fine", lastSuccessAt: ranAt });
  expect(await feedAt(t, "football", ranAt + FOOTBALL_LATE_AFTER + 1)).toMatchObject({ state: "late", lastSuccessAt: ranAt });
});

test("a feed whose last run failed is failing, with its error, and keeps its last success", async () => {
  const t = freshConvex();
  await recordRun(t, "football", T0);
  await recordRun(t, "football", T0 + HOUR_MS, { error: "FPL answered 503" });

  expect(await feedAt(t, "football", T0 + HOUR_MS)).toEqual({
    feed: "football",
    state: "failing",
    lastRunAt: T0 + HOUR_MS,
    lastSuccessAt: T0,
    lastError: { at: T0 + HOUR_MS, error: "FPL answered 503" },
  });
});

test("a feed fine again after a failure still shows the error", async () => {
  const t = freshConvex();
  await recordRun(t, "football", T0, { error: "FPL answered 503" });
  await recordRun(t, "football", T0 + HOUR_MS);

  expect(await feedAt(t, "football", T0 + HOUR_MS)).toMatchObject({
    state: "fine",
    lastSuccessAt: T0 + HOUR_MS,
    lastError: { at: T0, error: "FPL answered 503" },
  });
});

test("a run whose every match failed is a failure, though the run itself finished", async () => {
  const t = freshConvex();
  await recordRun(t, "matchStats", T0, { matchError: "gameweek 8's reads failed" });

  expect(await feedAt(t, "matchStats", T0)).toMatchObject({ state: "failing", lastSuccessAt: null, lastError: { error: "gameweek 8's reads failed" } });
});

test("a feed no cron runs is not scheduled, never late, however old its last success", async () => {
  const t = freshConvex();
  await recordRun(t, "positions", T0);

  const long = T0 + 30 * 24 * HOUR_MS;
  expect(await feedAt(t, "positions", long)).toMatchObject({ state: "notScheduled", lastSuccessAt: T0 });
});

// A late-stats run with no match due still records a success, so a quiet week is never late.
test("late stats that stop are late once their 10-minute schedule passes with no success, and fine up to then", async () => {
  const t = freshConvex();
  await recordRun(t, "matchStats", T0);

  expect(await feedAt(t, "matchStats", T0 + MATCH_STATS_LATE_AFTER)).toMatchObject({ state: "fine", lastSuccessAt: T0 });
  expect(await feedAt(t, "matchStats", T0 + MATCH_STATS_LATE_AFTER + 1)).toMatchObject({ state: "late", lastSuccessAt: T0 });
});

test("a success further back than the runs read is not found, and the feed is failing", async () => {
  const t = freshConvex();
  await recordRun(t, "liveStats", T0);
  for (let minute = 1; minute <= RUNS_READ; minute += 1) {
    await recordRun(t, "liveStats", T0 + minute * MINUTE_MS, { error: "refused" });
  }
  expect(await feedAt(t, "liveStats", T0 + RUNS_READ * MINUTE_MS)).toMatchObject({ state: "failing", lastSuccessAt: null });
});

test("between matches the live tick owes nothing, so it is fine however long since its last tick", async () => {
  const t = freshConvex();
  await recordRun(t, "liveStats", T0);
  await holdMatch(t, 1, T0 + 24 * HOUR_MS);

  expect(await feedAt(t, "liveStats", T0 + 24 * HOUR_MS - 1)).toMatchObject({ state: "fine", lastSuccessAt: T0 });
});

test("during a match the live tick is late once its interval passes with no success since kickoff", async () => {
  const t = freshConvex();
  await recordRun(t, "liveStats", T0); // the last match's
  const kickoff = T0 + 24 * HOUR_MS;
  await holdMatch(t, 1, kickoff);

  expect((await feedAt(t, "liveStats", kickoff + LIVE_LATE_AFTER)).state).toBe("fine");
  expect((await feedAt(t, "liveStats", kickoff + LIVE_LATE_AFTER + 1)).state).toBe("late");

  await recordRun(t, "liveStats", kickoff + 20 * MINUTE_MS);
  expect((await feedAt(t, "liveStats", kickoff + 20 * MINUTE_MS + LIVE_LATE_AFTER)).state).toBe("fine");
  expect((await feedAt(t, "liveStats", kickoff + 20 * MINUTE_MS + LIVE_LATE_AFTER + 1)).state).toBe("late");
});

test("a live tick that has never run is late once a match is under way past its interval", async () => {
  const t = freshConvex();
  await holdMatch(t, 1, T0);

  expect((await feedAt(t, "liveStats", T0 + LIVE_LATE_AFTER)).state).toBe("notRunningYet");
  expect((await feedAt(t, "liveStats", T0 + LIVE_LATE_AFTER + 1)).state).toBe("late");
});

test("a match complete at full time is no longer live, so the tick owes nothing for it", async () => {
  const t = freshConvex();
  await recordRun(t, "liveStats", T0);
  await holdMatch(t, 1, T0);
  await holdStatus(t, 1, T0 + 2 * HOUR_MS, "complete");

  expect((await feedAt(t, "liveStats", T0 + 3 * HOUR_MS)).state).toBe("fine");
});
