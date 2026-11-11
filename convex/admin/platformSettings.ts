import { v, type Infer } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { platformSettingName } from "../schema/matchStats";
import { adminOf, refuse } from "../shared/leagueAccess";
import { HOUR_MS, MINUTE_MS } from "../shared/time";

// The platform's own settings, one row each, the admin's to change on his dashboard (spec/15,
// #1555). The internal setters below set one or two at a time, for tests and the command line.

type SettingName = Infer<typeof platformSettingName>;

/** Every platform setting, as the admin's dashboard shows and saves them. */
export type PlatformSettings = Record<SettingName, number>;

/** How long after full time a match's stats stay open to corrections (spec/07), until set. */
const DEFAULT_STAT_CORRECTION_WINDOW_MINUTES = 60;

/** How many scouts each team has (spec/19, Scouts: "3 scouts, a number the site sets"), until set. */
export const DEFAULT_SCOUTS_PER_TEAM = 3;

/** Each setting until the admin sets it. League home's matchday mode (spec/12, League home) runs
 *  from this many hours before a matchday's first kickoff to this many after its last final
 *  whistle ("hours the site can tune"). */
const DEFAULTS: PlatformSettings = {
  statCorrectionWindowMinutes: DEFAULT_STAT_CORRECTION_WINDOW_MINUTES,
  scoutsPerTeam: DEFAULT_SCOUTS_PER_TEAM,
  matchdayHoursBefore: 3,
  matchdayHoursAfter: 2,
};

const NAMES = Object.keys(DEFAULTS) as SettingName[];

/** Why a setting is refused, as the admin is told it. */
export const settingRefusals: Record<SettingName, (value: number) => string> = {
  statCorrectionWindowMinutes: (value) => `The stat-correction window is a whole number of minutes, 0 or more, not ${value}.`,
  scoutsPerTeam: (value) => `A team's scouts are a whole number, 0 or more, not ${value}.`,
  matchdayHoursBefore: (value) => `Matchday mode's hours before are a whole number, 0 or more, not ${value}.`,
  matchdayHoursAfter: (value) => `Matchday mode's hours after are a whole number, 0 or more, not ${value}.`,
};

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
    const values = await Promise.all(NAMES.map(async (name) => (await settingRow(ctx, name))?.value ?? DEFAULTS[name]));
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

/** Sets the window. A lock already scheduled reads it again when it fires. */
export const setStatCorrectionWindow = internalMutation({
  args: { minutes: v.number() },
  returns: v.null(),
  handler: async (ctx, { minutes }) => {
    await saveAll(ctx, { statCorrectionWindowMinutes: minutes });
    return null;
  },
});

/** Sets how many scouts each team has. A scout already out stays out; only new sends count it. */
export const setScoutsPerTeam = internalMutation({
  args: { scouts: v.number() },
  returns: v.null(),
  handler: async (ctx, { scouts }) => {
    await saveAll(ctx, { scoutsPerTeam: scouts });
    return null;
  },
});

/** How long matchday mode runs before a matchday's first kickoff and after its last final whistle,
 *  in milliseconds: the admin's settings, or the defaults. */
export async function matchdayMargins(ctx: QueryCtx): Promise<{ beforeMs: number; afterMs: number }> {
  const [before, after] = await Promise.all([valueOf(ctx, "matchdayHoursBefore"), valueOf(ctx, "matchdayHoursAfter")]);
  return { beforeMs: before * HOUR_MS, afterMs: after * HOUR_MS };
}

/** Sets matchday mode's hours, before the first kickoff and after the last final whistle. */
export const setMatchdayHours = internalMutation({
  args: { before: v.number(), after: v.number() },
  returns: v.null(),
  handler: async (ctx, { before, after }) => {
    await saveAll(ctx, { matchdayHoursBefore: before, matchdayHoursAfter: after });
    return null;
  },
});

const isWholeAndNotBelowNought = (value: number) => Number.isInteger(value) && value >= 0;

/** Checks every value before setting any, so a refusal sets nothing. */
async function saveAll(ctx: MutationCtx, values: Partial<PlatformSettings>) {
  const entries = Object.entries(values) as [SettingName, number][];
  for (const [name, value] of entries) if (!isWholeAndNotBelowNought(value)) refuse(settingRefusals[name](value));
  for (const [name, value] of entries) await setSetting(ctx, name, value);
}

async function valueOf(ctx: QueryCtx, name: SettingName): Promise<number> {
  return (await settingRow(ctx, name))?.value ?? DEFAULTS[name];
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
