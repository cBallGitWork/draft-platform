// The stat-correction window, the admin's to set (spec/07, spec/15). How the lock reads it:
// tests/convex/stats/matchStats.lock.test.ts.

import { expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { statCorrectionWindowMs } from "../../../convex/admin/platformSettings";
import { MINUTE_MS } from "../../../convex/shared/time";
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
