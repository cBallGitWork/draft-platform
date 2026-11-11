import { v, type Infer } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { platformSettingName } from "../schema";
import { HOUR_MS, MINUTE_MS } from "../shared/time";

// The platform's own settings, one row each, the admin's to change (spec/15). Until the admin
// screen exists: `npx convex run admin/platformSettings:setStatCorrectionWindow '{"minutes":60}'`,
// `npx convex run admin/platformSettings:setScoutsPerTeam '{"scouts":3}'`,
// or `npx convex run admin/platformSettings:setMatchdayHours '{"before":3,"after":2}'`.

type SettingName = Infer<typeof platformSettingName>;

/** How long after full time a match's stats stay open to corrections (spec/07), until set. */
const DEFAULT_STAT_CORRECTION_WINDOW_MINUTES = 60;

/** How many scouts each team has (spec/19, Scouts: "3 scouts, a number the site sets"), until set. */
export const DEFAULT_SCOUTS_PER_TEAM = 3;

/** League home's matchday mode (spec/12, League home): from this many hours before a matchday's
 *  first kickoff to this many after its last final whistle, until set ("hours the site can tune"). */
const DEFAULT_MATCHDAY_HOURS = { before: 3, after: 2 } as const;

const STAT_CORRECTION_WINDOW = "statCorrectionWindowMinutes";
const SCOUTS_PER_TEAM = "scoutsPerTeam";
const MATCHDAY_HOURS = { before: "matchdayHoursBefore", after: "matchdayHoursAfter" } as const satisfies Record<string, SettingName>;

/** The stat-correction window in milliseconds: the admin's setting, or the default. */
export async function statCorrectionWindowMs(ctx: QueryCtx): Promise<number> {
  const row = await settingRow(ctx, STAT_CORRECTION_WINDOW);
  return (row?.value ?? DEFAULT_STAT_CORRECTION_WINDOW_MINUTES) * MINUTE_MS;
}

/** How many scouts each team has: the admin's setting, or the default. */
export async function scoutsPerTeam(ctx: QueryCtx): Promise<number> {
  return (await settingRow(ctx, SCOUTS_PER_TEAM))?.value ?? DEFAULT_SCOUTS_PER_TEAM;
}

/** Sets the window. A lock already scheduled reads it again when it fires. */
export const setStatCorrectionWindow = internalMutation({
  args: { minutes: v.number() },
  returns: v.null(),
  handler: async (ctx, { minutes }) => {
    if (!isWholeAndNotBelowNought(minutes)) {
      throw new Error(`The stat-correction window is a whole number of minutes, 0 or more, not ${minutes}`);
    }
    await setSetting(ctx, STAT_CORRECTION_WINDOW, minutes);
    return null;
  },
});

/** Sets how many scouts each team has. A scout already out stays out; only new sends count it. */
export const setScoutsPerTeam = internalMutation({
  args: { scouts: v.number() },
  returns: v.null(),
  handler: async (ctx, { scouts }) => {
    if (!isWholeAndNotBelowNought(scouts)) throw new Error(`A team's scouts are a whole number, 0 or more, not ${scouts}`);
    await setSetting(ctx, SCOUTS_PER_TEAM, scouts);
    return null;
  },
});

/** How long matchday mode runs before a matchday's first kickoff and after its last final whistle,
 *  in milliseconds: the admin's settings, or the defaults. */
export async function matchdayMargins(ctx: QueryCtx): Promise<{ beforeMs: number; afterMs: number }> {
  const [before, after] = await Promise.all([settingRow(ctx, MATCHDAY_HOURS.before), settingRow(ctx, MATCHDAY_HOURS.after)]);
  return { beforeMs: (before?.value ?? DEFAULT_MATCHDAY_HOURS.before) * HOUR_MS, afterMs: (after?.value ?? DEFAULT_MATCHDAY_HOURS.after) * HOUR_MS };
}

/** Sets matchday mode's hours, before the first kickoff and after the last final whistle. */
export const setMatchdayHours = internalMutation({
  args: { before: v.number(), after: v.number() },
  returns: v.null(),
  handler: async (ctx, hours) => {
    for (const [which, value] of Object.entries(hours)) {
      if (!isWholeAndNotBelowNought(value)) throw new Error(`Matchday mode's hours ${which} are a whole number, 0 or more, not ${value}`);
    }
    await setSetting(ctx, MATCHDAY_HOURS.before, hours.before);
    await setSetting(ctx, MATCHDAY_HOURS.after, hours.after);
    return null;
  },
});

const isWholeAndNotBelowNought = (value: number) => Number.isInteger(value) && value >= 0;

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
