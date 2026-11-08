// The stat-correction window and matchday mode's hours, the admin's to set (spec/07, spec/12,
// spec/15). How the lock reads the window: tests/convex/stats/matchStats.lock.test.ts.

import { expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { matchdayMargins, statCorrectionWindowMs } from "../../../convex/admin/platformSettings";
import { HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import { freshConvex } from "../../support/convex/test.harness";

test("a window set again replaces the one set before", async () => {
  const t = freshConvex();
  for (const minutes of [30, 90]) await t.mutation(internal.admin.platformSettings.setStatCorrectionWindow, { minutes });

  expect(await t.run((ctx) => statCorrectionWindowMs(ctx))).toBe(90 * MINUTE_MS);
  expect(await t.run((ctx) => ctx.db.query("platformSettings").collect())).toHaveLength(1);
});

test.each([-1, 1.5])("a window of %s minutes is refused", async (minutes) => {
  const t = freshConvex();
  await expect(t.mutation(internal.admin.platformSettings.setStatCorrectionWindow, { minutes })).rejects.toThrow(
    `whole number of minutes, 0 or more, not ${minutes}`,
  );
});

// League home's matchday mode (spec/12): "hours the site can tune".
test("matchday mode runs 3 hours before and 2 after until set, then the hours set, one row each", async () => {
  const t = freshConvex();
  expect(await t.run((ctx) => matchdayMargins(ctx))).toEqual({ beforeMs: 3 * HOUR_MS, afterMs: 2 * HOUR_MS });

  for (const before of [4, 1]) await t.mutation(internal.admin.platformSettings.setMatchdayHours, { before, after: 0 });
  expect(await t.run((ctx) => matchdayMargins(ctx))).toEqual({ beforeMs: HOUR_MS, afterMs: 0 });
  expect(await t.run((ctx) => ctx.db.query("platformSettings").collect())).toHaveLength(2);
});

test("matchday hours of 1.5 are refused, and nothing is set", async () => {
  const t = freshConvex();
  await expect(t.mutation(internal.admin.platformSettings.setMatchdayHours, { before: 3, after: 1.5 })).rejects.toThrow(
    "hours after are a whole number, 0 or more, not 1.5",
  );
  expect(await t.run((ctx) => ctx.db.query("platformSettings").collect())).toEqual([]);
});
