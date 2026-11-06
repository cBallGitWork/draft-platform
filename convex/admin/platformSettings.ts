import { v, type Infer } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { MINUTE_MS } from "../shared/time";

// The platform's own settings, one row each, the admin's to change (spec/15). Until the admin
// screen exists: `npx convex run admin/platformSettings:setStatCorrectionWindow '{"minutes":60}'`,
// or `npx convex run admin/platformSettings:setScoutsPerTeam '{"scouts":3}'`.

/** How long after full time a match's stats stay open to corrections (spec/07), until set. */
const DEFAULT_STAT_CORRECTION_WINDOW_MINUTES = 60;

/** How many scouts each team has (spec/19, Scouts: "3 scouts, a number the site sets"), until set. */
export const DEFAULT_SCOUTS_PER_TEAM = 3;

const STAT_CORRECTION_WINDOW = "statCorrectionWindowMinutes";
const SCOUTS_PER_TEAM = "scoutsPerTeam";

type SettingName = Infer<typeof settingName>;
const settingName = v.union(v.literal(STAT_CORRECTION_WINDOW), v.literal(SCOUTS_PER_TEAM));

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
    if (!Number.isInteger(minutes) || minutes < 0) {
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
    if (!Number.isInteger(scouts) || scouts < 0) throw new Error(`A team's scouts are a whole number, 0 or more, not ${scouts}`);
    await setSetting(ctx, SCOUTS_PER_TEAM, scouts);
    return null;
  },
});

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
