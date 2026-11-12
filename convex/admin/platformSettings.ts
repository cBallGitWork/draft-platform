import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { adminOf, refuse } from "../shared/leagueAccess";
import { HOUR_MS, MINUTE_MS } from "../shared/time";
import { FIRST_PLATFORM_SETTINGS, settingRefusals, type PlatformSettings, type SettingName } from "./platformSettingDefaults";

// The platform's own settings, one row each, the admin's to change on his dashboard (spec/15,
// #1555). The internal setSettings sets any of them, for tests and the command line.
// The defaults and refusals live in platformSettingDefaults.ts, which the browser's preview reads.

export type { PlatformSettings };

const NAMES = Object.keys(FIRST_PLATFORM_SETTINGS) as SettingName[];

const platformSettings = v.object({
  statCorrectionWindowMinutes: v.number(),
  scoutsPerTeam: v.number(),
  matchdayHoursBefore: v.number(),
  matchdayHoursAfter: v.number(),
});

/** Every platform setting, the admin's or the default, for his dashboard. */
export const settings = query({
  args: {},
  returns: platformSettings,
  handler: async (ctx): Promise<PlatformSettings> => {
    await adminOf(ctx);
    const values = await Promise.all(NAMES.map((name) => valueOf(ctx, name)));
    return Object.fromEntries(NAMES.map((name, i) => [name, values[i]])) as PlatformSettings;
  },
});

/** Saves every platform setting from the admin's dashboard; one refused saves none. A lock
 *  already scheduled reads the window again when it fires, and a scout already out stays out. */
export const save = mutation({
  args: platformSettings.fields,
  returns: v.null(),
  handler: async (ctx, values) => {
    await adminOf(ctx);
    await saveAll(ctx, values);
    return null;
  },
});

/** The stat-correction window in milliseconds: the admin's setting, or the default. */
export async function statCorrectionWindowMs(ctx: QueryCtx): Promise<number> {
  return (await valueOf(ctx, "statCorrectionWindowMinutes")) * MINUTE_MS;
}

/** How many scouts each team has: the admin's setting, or the default. */
export function scoutsPerTeam(ctx: QueryCtx): Promise<number> {
  return valueOf(ctx, "scoutsPerTeam");
}

/** Sets any of the settings, as `save` does without the admin, for tests and the command line
 *  (`npx convex run admin/platformSettings:setSettings '{"scoutsPerTeam": 2}'`). */
export const setSettings = internalMutation({
  args: {
    statCorrectionWindowMinutes: v.optional(v.number()),
    scoutsPerTeam: v.optional(v.number()),
    matchdayHoursBefore: v.optional(v.number()),
    matchdayHoursAfter: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, values) => {
    await saveAll(ctx, values);
    return null;
  },
});

/** How long matchday mode runs before a matchday's first kickoff and after its last final whistle,
 *  in milliseconds: the admin's settings, or the defaults. */
export async function matchdayMargins(ctx: QueryCtx): Promise<{ beforeMs: number; afterMs: number }> {
  const [before, after] = await Promise.all([valueOf(ctx, "matchdayHoursBefore"), valueOf(ctx, "matchdayHoursAfter")]);
  return { beforeMs: before * HOUR_MS, afterMs: after * HOUR_MS };
}

const isWholeAndNotBelowNought = (value: number) => Number.isInteger(value) && value >= 0;

/** Checks every value before setting any, so a refusal sets nothing. */
async function saveAll(ctx: MutationCtx, values: Partial<PlatformSettings>) {
  const entries = Object.entries(values) as [SettingName, number][];
  for (const [name, value] of entries) if (!isWholeAndNotBelowNought(value)) refuse(settingRefusals[name](value));
  for (const [name, value] of entries) await setSetting(ctx, name, value);
}

async function valueOf(ctx: QueryCtx, name: SettingName): Promise<number> {
  return (await settingRow(ctx, name))?.value ?? FIRST_PLATFORM_SETTINGS[name];
}

function settingRow(ctx: QueryCtx, name: SettingName) {
  return ctx.db
    .query("platformSettings")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique();
}

async function setSetting(ctx: MutationCtx, name: SettingName, value: number) {
  const row = await settingRow(ctx, name);
  if (row === null) await ctx.db.insert("platformSettings", { name, value });
  else await ctx.db.patch("platformSettings", row._id, { value });
}
