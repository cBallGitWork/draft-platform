// #200: positions from starts' settings move from their own one-row table to platformSettings, the
// home of every platform-wide setting. Until the move has run, the old row still counts.

import { expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import { asAdmin } from "../../support/convex/positionsSync.harness";
import { freshConvex, type TestConvex } from "../../support/convex/test.harness";

const queueOf = async (t: TestConvex) => (await asAdmin(t)).query(api.positions.playerPositions.queue, {});
const move = (t: TestConvex) => t.mutation(internal.positions.positionSettingsMove.moveToPlatformSettings, {});
const platformRows = (t: TestConvex) => t.run((ctx) => ctx.db.query("platformSettings").collect());

test("the admin's settings save among the platform's, one row each", async () => {
  const t = freshConvex();
  const admin = await asAdmin(t);
  await admin.mutation(api.positions.positionSettings.setChangeThresholds, { flagAfter: 2, removeAfter: 4 });
  await admin.mutation(api.positions.positionSettings.setApproveMode, { approveMode: "countAtOnce" });

  expect((await platformRows(t)).map(({ name, value }) => [name, value])).toEqual([
    ["positionsFlagAfter", 2],
    ["positionsRemoveAfter", 4],
    ["positionsApproveMode", "countAtOnce"],
  ]);
  expect(await t.run((ctx) => ctx.db.query("positionSettings").collect())).toEqual([]);
});

test("before the move runs, a setting saved only in the old row still counts", async () => {
  const t = freshConvex();
  await t.run((ctx) => ctx.db.insert("positionSettings", { approveMode: "countAtOnce", flagAfter: 2, removeAfter: 4 }));
  expect(await queueOf(t)).toMatchObject({ approveMode: "countAtOnce", thresholds: { flagAfter: 2, removeAfter: 4 } });

  await (await asAdmin(t)).mutation(api.positions.positionSettings.setApproveMode, { approveMode: "proposals" });

  expect(await queueOf(t)).toMatchObject({ approveMode: "proposals", thresholds: { flagAfter: 2, removeAfter: 4 } });
});

test("the move copies the old row's settings, keeps a newer one, deletes the row, and does nothing run again", async () => {
  const t = freshConvex();
  await t.run((ctx) => ctx.db.insert("positionSettings", { approveMode: "countAtOnce", flagAfter: 2, removeAfter: 4 }));
  await (await asAdmin(t)).mutation(api.positions.positionSettings.setApproveMode, { approveMode: "proposals" });

  expect(await move(t)).toEqual({ settingsMoved: 2, rowDeleted: true });

  expect(await t.run((ctx) => ctx.db.query("positionSettings").collect())).toEqual([]);
  expect(await queueOf(t)).toMatchObject({ approveMode: "proposals", thresholds: { flagAfter: 2, removeAfter: 4 } });
  expect(await move(t)).toEqual({ settingsMoved: 0, rowDeleted: false });
  expect(await platformRows(t)).toHaveLength(3);
});

test("an old row with no thresholds moves only how starts count", async () => {
  const t = freshConvex();
  await t.run((ctx) => ctx.db.insert("positionSettings", { approveMode: "countAtOnce" }));

  expect(await move(t)).toEqual({ settingsMoved: 1, rowDeleted: true });

  expect(await queueOf(t)).toMatchObject({ approveMode: "countAtOnce", thresholds: { flagAfter: 3, removeAfter: 6 } });
});
