import type { WithoutSystemFields } from "convex/server";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

// Reading and writing one platform setting's row (#200): the one home for every platform-wide
// setting, `platformSettings`, one row per name. Each setting's owner keeps its default and its
// checks: the dashboard's in admin/platformSettings.ts, positions from starts' in
// positions/positionSettings.ts.

type SettingRow = Doc<"platformSettings">;
export type PlatformSettingName = SettingRow["name"];

/** The one setting that isn't a number: whether positions from starts wait for the admin. */
type ModeRow = Extract<SettingRow, { name: "positionsApproveMode" }>;

/** What a setting holds: a number, or for positions from starts' approval, its mode. */
export type PlatformSettingValue<N extends PlatformSettingName> = N extends ModeRow["name"] ? ModeRow["value"] : number;

/** A setting's saved value, or undefined until the admin sets it. */
export async function savedSetting<N extends PlatformSettingName>(ctx: QueryCtx, name: N): Promise<PlatformSettingValue<N> | undefined> {
  return (await settingRow(ctx, name))?.value as PlatformSettingValue<N> | undefined;
}

/** Saves a setting, over its row or in a new one. */
export async function saveSetting<N extends PlatformSettingName>(ctx: MutationCtx, name: N, value: PlatformSettingValue<N>) {
  const row = await settingRow(ctx, name);
  if (row === null) await ctx.db.insert("platformSettings", { name, value } as WithoutSystemFields<SettingRow>);
  else await ctx.db.patch("platformSettings", row._id, { value } as Partial<SettingRow>);
}

function settingRow(ctx: QueryCtx, name: PlatformSettingName) {
  return ctx.db
    .query("platformSettings")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique();
}
