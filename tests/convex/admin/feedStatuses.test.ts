// Each feed's status row (#2500): the feeds page reads one row a feed, kept as each run is logged,
// never the feed's runs, so the minute's read stays small; what it shows is as it was when the page
// read the runs themselves (spec/15, the feeds page).

import { expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { FEED_RUN_TABLES } from "../../../convex/shared/feedSchedule";
import { HOUR_MS } from "../../../convex/shared/time";
import { feedAt, recordRun, T0 } from "../../support/convex/feeds.harness";
import { freshConvex, type TestConvex } from "../../support/convex/test.harness";

/** Every run row of the football sync deleted, as pruning would in time. */
const forgetFootballRuns = (t: TestConvex) =>
  t.run(async (ctx) => {
    for (const row of await ctx.db.query(FEED_RUN_TABLES.football).collect()) await ctx.db.delete(row._id);
  });

test("S15.2: the page judges a feed from its status row, never reading its runs", async () => {
  const t = freshConvex();
  await recordRun(t, "football", T0);
  await recordRun(t, "football", T0 + HOUR_MS, { error: "FPL answered 503" });
  const shown = await feedAt(t, "football", T0 + HOUR_MS);

  await forgetFootballRuns(t);
  expect(await feedAt(t, "football", T0 + HOUR_MS)).toEqual(shown);
  expect(shown).toMatchObject({ state: "failing", lastSuccessAt: T0, lastError: { at: T0 + HOUR_MS, error: "FPL answered 503" } });
});

test("S15.2: a run logged by its sync's own record keeps its feed's status row", async () => {
  const t = freshConvex();
  await t.mutation(internal.positions.positionsSync.record, { trigger: "manual", ranAt: T0, outcome: { ok: false, error: "the feed was down" } });

  const status = await t.run((ctx) => ctx.db.query("feedStatuses").collect());
  expect(status).toMatchObject([{ feed: "positions", lastRun: { ranAt: T0, failure: "the feed was down" }, lastError: { at: T0 } }]);
});

test("S15.2: a feed whose runs came before its status row is read from them, and its next run's row carries on from them", async () => {
  const t = freshConvex();
  const ok = { ok: true as const, clubs: NO_WRITES, players: NO_WRITES, fixtures: NO_WRITES, gameweeks: NO_WRITES };
  await t.run(async (ctx) => {
    await ctx.db.insert("footballSyncs", { trigger: "cron", ranAt: T0, outcome: ok });
    await ctx.db.insert("footballSyncs", { trigger: "cron", ranAt: T0 + HOUR_MS, outcome: { ok: false, error: "FPL answered 503" } });
  });
  expect(await feedAt(t, "football", T0 + HOUR_MS)).toMatchObject({ state: "failing", lastSuccessAt: T0, lastError: { at: T0 + HOUR_MS } });

  await recordRun(t, "football", T0 + 2 * HOUR_MS, { error: "FPL answered 502" });
  await forgetFootballRuns(t);
  expect(await feedAt(t, "football", T0 + 2 * HOUR_MS)).toMatchObject({
    state: "failing",
    lastRunAt: T0 + 2 * HOUR_MS,
    lastSuccessAt: T0,
    lastError: { at: T0 + 2 * HOUR_MS, error: "FPL answered 502" },
  });
});

const NO_WRITES = { received: 0, inserted: 0, updated: 0, marked: 0, unmarked: 0 };
