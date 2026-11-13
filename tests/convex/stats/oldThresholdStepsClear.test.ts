import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { OLD_STEPS_CLEARED_A_RUN } from "../../../convex/stats/oldThresholdStepsClear";
import { everyJobRuns, freshConvex, MADE_UP_CODES, pendingJobs, ROWS_TO_THE_CAP, type TestConvex } from "../../support/convex/test.harness";

// The one-off clear for #1755: the old `thresholdSteps` rows are deleted, a run at a time, so the
// table can leave the schema; running it again does nothing.

let t: TestConvex;
const clear = () => t.mutation(internal.stats.oldThresholdStepsClear.clearOldThresholdSteps, {});
const oldRows = () => t.run((ctx) => ctx.db.query("thresholdSteps").collect());
const insertOldRows = (count: number) =>
  t.run(async (ctx) => {
    for (let i = 0; i < count; i++) {
      await ctx.db.insert("thresholdSteps", { fixtureCode: MADE_UP_CODES, playerCode: MADE_UP_CODES + i, stat: "saves", from: 2, to: 3, minutes: 60, minute: 60 });
    }
  });

beforeEach(() => {
  vi.useFakeTimers();
  t = freshConvex();
});
afterEach(() => vi.useRealTimers());

test("a few old rows go in one run, and a second run finds none", async () => {
  await insertOldRows(3);
  expect(await clear()).toEqual({ deleted: 3, more: false });
  expect(await oldRows()).toEqual([]);
  expect(await pendingJobs(t)).toEqual([]);
  expect(await clear()).toEqual({ deleted: 0, more: false });
});

test("more rows than a run deletes are left to the run it schedules next", ROWS_TO_THE_CAP, async () => {
  await insertOldRows(OLD_STEPS_CLEARED_A_RUN + 1);
  expect(await clear()).toEqual({ deleted: OLD_STEPS_CLEARED_A_RUN, more: true });
  expect(await oldRows()).toHaveLength(1);
  expect(await pendingJobs(t, internal.stats.oldThresholdStepsClear.clearOldThresholdSteps)).toHaveLength(1);
  await everyJobRuns(t);
  expect(await oldRows()).toEqual([]);
});

test("the live reads' store is left alone", async () => {
  await t.run((ctx) => ctx.db.insert("thresholdStepReads", { fixtureCode: MADE_UP_CODES, minute: 60, steps: [] }));
  await insertOldRows(1);
  await clear();
  expect(await t.run((ctx) => ctx.db.query("thresholdStepReads").collect())).toHaveLength(1);
});
