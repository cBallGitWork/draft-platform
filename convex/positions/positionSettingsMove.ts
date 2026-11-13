import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { savedSetting, saveSetting, type PlatformSettingName, type PlatformSettingValue } from "../shared/platformSettingRows";
import { leavingRow } from "./positionSettings";

// The one-off migration for #200: positions from starts' settings move from their own one-row
// table, positionSettings, to platformSettings, the home of every platform-wide setting. A setting
// already saved there is newer, so it stays. Then the old row is deleted, so running it again does
// nothing. Run it once on each deployment:
//   npx convex run positions/positionSettingsMove:moveToPlatformSettings
//   npx convex run --prod positions/positionSettingsMove:moveToPlatformSettings

/** Moves the old row's settings, then deletes it; returns how many settings moved, and whether there was a row. */
export const moveToPlatformSettings = internalMutation({
  args: {},
  returns: v.object({ settingsMoved: v.number(), rowDeleted: v.boolean() }),
  handler: async (ctx) => {
    const row = await leavingRow(ctx);
    if (row === null) return { settingsMoved: 0, rowDeleted: false };
    let settingsMoved = 0;
    const move = async <N extends PlatformSettingName>(name: N, value: PlatformSettingValue<N> | undefined) => {
      if (value === undefined || (await savedSetting(ctx, name)) !== undefined) return;
      await saveSetting(ctx, name, value);
      settingsMoved += 1;
    };
    await move("positionsApproveMode", row.approveMode);
    await move("positionsFlagAfter", row.flagAfter);
    await move("positionsRemoveAfter", row.removeAfter);
    await ctx.db.delete("positionSettings", row._id);
    return { settingsMoved, rowDeleted: true };
  },
});
