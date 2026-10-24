// Pruning the feeds' run logs (#146): a success goes after 30 days and a failure after 180, but a
// feed's newest runs and its newest success always stay, in batches, liveStatsTicks first.

import { afterEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { PRUNE_ORDER } from "../../../convex/admin/runLogs";
import { FEED_RUN_TABLES, FEEDS, type Feed } from "../../../convex/shared/feedSchedule";
import { BATCH_SIZE, FAILURE_KEPT_MS, LATEST_RUNS, SUCCESS_KEPT_MS } from "../../../convex/shared/syncRuns";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import { recordRun, T0, type Ran } from "../../support/convex/feeds.harness";
import { freshConvex, type TestConvex } from "../../support/convex/test.harness";

const NOW = T0;

afterEach(() => {
  vi.useRealTimers();
});

/** `feed`'s newest `LATEST_RUNS` runs, a minute apart in the hour before `NOW`, each as `ran` says. */
async function recentRuns(t: TestConvex, feed: Feed, ran: Ran = "ok") {
  for (let index = LATEST_RUNS; index > 0; index -= 1) await recordRun(t, feed, NOW - index * MINUTE_MS, ran);
}

/** Every run log pruned at `NOW`, each batch handing on to the next until none is left. */
async function prune(t: TestConvex) {
  vi.useFakeTimers({ now: NOW });
  await t.mutation(internal.admin.runLogs.prune, { startedAt: NOW });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

/** When each of `feed`'s runs still held started, oldest first. */
function ranAtOf(t: TestConvex, feed: Feed) {
  return t.run(async (ctx) => (await ctx.db.query(FEED_RUN_TABLES[feed]).collect()).map((row) => row.ranAt));
}

const recent = (ranAts: number[]) => ranAts.filter((ranAt) => ranAt > NOW - HOUR_MS);
const old = (ranAts: number[]) => ranAts.filter((ranAt) => ranAt <= NOW - HOUR_MS);

test("the prune order starts with liveStatsTicks and names every feed once", () => {
  expect(PRUNE_ORDER[0]).toBe("liveStats");
  expect([...PRUNE_ORDER].sort()).toEqual([...FEEDS].sort());
});

test.each(FEEDS)("a %s success older than 30 days goes; one younger stays", async (feed) => {
  const t = freshConvex();
  await recordRun(t, feed, NOW - SUCCESS_KEPT_MS - 10 * DAY_MS);
  await recordRun(t, feed, NOW - SUCCESS_KEPT_MS - 1);
  await recordRun(t, feed, NOW - SUCCESS_KEPT_MS + DAY_MS);
  await recentRuns(t, feed);

  await prune(t);
  expect(old(await ranAtOf(t, feed))).toEqual([NOW - SUCCESS_KEPT_MS + DAY_MS]);
  expect(recent(await ranAtOf(t, feed))).toHaveLength(LATEST_RUNS);
});

test("a failure stays for 180 days, a run with one failed match counted as one", async () => {
  const t = freshConvex();
  const tooOld = NOW - FAILURE_KEPT_MS - 1;
  const keptFailure = NOW - FAILURE_KEPT_MS + DAY_MS;
  const keptMatchFailure = NOW - SUCCESS_KEPT_MS - DAY_MS;
  await recordRun(t, "liveStats", tooOld - 1, { error: "FPL answered 503" });
  await recordRun(t, "liveStats", tooOld, { matchError: "PL answered 503" });
  await recordRun(t, "liveStats", keptFailure, { error: "FPL answered 503" });
  await recordRun(t, "liveStats", keptMatchFailure, { matchError: "PL answered 503" });
  await recentRuns(t, "liveStats");

  await prune(t);
  expect(old(await ranAtOf(t, "liveStats"))).toEqual([keptFailure, keptMatchFailure]);
});

test("a feed's newest runs stay however old, failed or not", async () => {
  const t = freshConvex();
  const yearAgo = NOW - 365 * DAY_MS;
  await recordRun(t, "football", yearAgo - DAY_MS);
  for (let index = 0; index < LATEST_RUNS; index += 1) await recordRun(t, "football", yearAgo + index, index % 2 ? "ok" : { error: "FPL answered 503" });

  await prune(t);
  expect(await ranAtOf(t, "football")).toEqual(Array.from({ length: LATEST_RUNS }, (_, index) => yearAgo + index));
});

// positionSettings.ts judges positions from the newest sync that read its starts.
test("a feed's newest success stays however old while every newer run failed", async () => {
  const t = freshConvex();
  const older = NOW - 60 * DAY_MS;
  const newestSuccess = NOW - 50 * DAY_MS;
  await recordRun(t, "positions", older);
  await recordRun(t, "positions", newestSuccess);
  await recentRuns(t, "positions", { error: "PL answered 503" });

  await prune(t);
  expect(old(await ranAtOf(t, "positions"))).toEqual([newestSuccess]);
});

test("an old success goes once a younger one is kept, though every newest run failed", async () => {
  const t = freshConvex();
  const youngerSuccess = NOW - SUCCESS_KEPT_MS + DAY_MS;
  await recordRun(t, "positions", NOW - SUCCESS_KEPT_MS - DAY_MS);
  await recordRun(t, "positions", youngerSuccess);
  await recentRuns(t, "positions", { error: "PL answered 503" });

  await prune(t);
  expect(old(await ranAtOf(t, "positions"))).toEqual([youngerSuccess]);
});

// The feeds page's last success is a run with no failed match, so one that read a failed match
// mustn't stand in for it.
test("a run with a failed match never stands in for the newest success", async () => {
  const t = freshConvex();
  const newestSuccess = NOW - 60 * DAY_MS;
  const matchFailure = NOW - 40 * DAY_MS;
  await recordRun(t, "liveStats", newestSuccess);
  await recordRun(t, "liveStats", matchFailure, { matchError: "PL answered 503" });
  await recentRuns(t, "liveStats", { error: "FPL answered 503" });

  await prune(t);
  expect(old(await ranAtOf(t, "liveStats"))).toEqual([newestSuccess, matchFailure]);
});

test("more old runs than a batch are all pruned, batch by batch, and so is the next feed's log", async () => {
  const t = freshConvex();
  const runs = 2 * BATCH_SIZE + 1;
  const firstRun = NOW - SUCCESS_KEPT_MS - runs * HOUR_MS;
  await t.run(async (ctx) => {
    for (let index = 0; index < runs; index += 1) {
      await ctx.db.insert("liveStatsTicks", { ranAt: firstRun + index * HOUR_MS, outcome: { ok: true, matches: [] } });
    }
  });
  await recentRuns(t, "liveStats");
  await recordRun(t, "matchStats", firstRun);
  await recentRuns(t, "matchStats");

  await prune(t);
  expect(await ranAtOf(t, "liveStats")).toHaveLength(LATEST_RUNS);
  expect(await ranAtOf(t, "matchStats")).toHaveLength(LATEST_RUNS);
});

test("with nothing old, nothing goes", async () => {
  const t = freshConvex();
  for (const feed of FEEDS) await recentRuns(t, feed);
  await prune(t);
  for (const feed of FEEDS) expect(await ranAtOf(t, feed)).toHaveLength(LATEST_RUNS);
});
