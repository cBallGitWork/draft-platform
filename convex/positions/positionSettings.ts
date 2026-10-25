import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { fplDeadlines } from "../gameweeks/usedGameweeks";
import { adminOf, refuse } from "../shared/leagueAccess";
import { FIRST_THRESHOLDS, type ChangeThresholds } from "./positionChanges";
import { START_WINDOW, type ApproveMode, type PositionInputs } from "./positions";
import { approveMode, changeThresholds } from "../schema";

// How positions from starts count and change, platform-wide (spec/06): the admin's settings, his
// alone to change, and the gameweek boundary changes are judged at.

/** Spec/06: at first, positions from starts wait for the admin. */
const FIRST_APPROVE_MODE: ApproveMode = "proposals";

/** Why thresholds are refused, as the admin is told it. */
export const thresholdRefusals = {
  flagAfter: "Flag a position after a whole number of starts, 1 or more.",
  removeAfter: "Remove a position after a whole number of starts, more than it takes to flag it.",
  pastWindow: `Remove a position after ${START_WINDOW} starts at most: no more are held.`,
} as const;

/** Whether positions from starts wait for his approval or count at once (spec/06). */
export const setApproveMode = mutation({
  args: { approveMode },
  returns: v.null(),
  handler: async (ctx, { approveMode: mode }) => {
    await adminOf(ctx);
    await saveSettings(ctx, { approveMode: mode });
    return null;
  },
});

/** How many starts in a row elsewhere flag a position from starts, and how many remove it
 *  (spec/06, When positions change). A run can't pass the starts held, so a longer one is refused. */
export const setChangeThresholds = mutation({
  args: changeThresholds.fields,
  returns: v.null(),
  handler: async (ctx, { flagAfter, removeAfter }) => {
    await adminOf(ctx);
    if (!Number.isInteger(flagAfter) || flagAfter < 1) refuse(thresholdRefusals.flagAfter);
    if (!Number.isInteger(removeAfter) || removeAfter <= flagAfter) refuse(thresholdRefusals.removeAfter);
    if (removeAfter > START_WINDOW) refuse(thresholdRefusals.pastWindow);
    await saveSettings(ctx, { flagAfter, removeAfter });
    return null;
  },
});

/** Everything `positionsOf` reads besides a player's own row. */
export type HowPositionsCount = Pick<PositionInputs, "approveMode" | "thresholds" | "judgedBefore">;

export async function howPositionsCount(ctx: QueryCtx): Promise<HowPositionsCount> {
  const settings = await settingsRow(ctx);
  return {
    approveMode: settings?.approveMode ?? FIRST_APPROVE_MODE,
    thresholds: thresholdsOf(settings),
    judgedBefore: await judgedBefore(ctx),
  };
}

function thresholdsOf(settings: Doc<"positionSettings"> | null): ChangeThresholds {
  return {
    flagAfter: settings?.flagAfter ?? FIRST_THRESHOLDS.flagAfter,
    removeAfter: settings?.removeAfter ?? FIRST_THRESHOLDS.removeAfter,
  };
}

/** Positions change only between gameweeks (spec/06): the starts judged are those before the last
 *  FPL deadline the newest good positions sync ran after, so a sync within a gameweek moves nothing.
 *  The sync's time stands in for the clock, which a query can't read. Null, judging every start,
 *  before any sync or the season's first deadline (docs/positions.md, When positions change).
 *  FPL's deadline, not a league's, by Claude's choice: positions are the whole deployment's, not
 *  one league's, so the one cut-off every league shares is FPL's. A league's gameweek begins at
 *  its own deadline (#138). */
async function judgedBefore(ctx: QueryCtx): Promise<number | null> {
  const newestSync = await newestGoodSync(ctx);
  if (newestSync === null) return null;
  const passed = [...(await fplDeadlines(ctx)).values()].filter((deadline) => deadline <= newestSync.ranAt);
  return passed.length === 0 ? null : Math.max(...passed);
}

/** How many of the newest positions syncs are looked through for one that read its starts: the
 *  sync is run by hand for now, and even run daily, a thousand failing in a row is years of a feed
 *  nobody fixed. Past it this throws rather than judge every start as if none had run (#214). */
export const SYNCS_SEARCHED_MOST = 1000;

/** The newest sync that read its starts: a failed one read nothing, so it moves no boundary. */
async function newestGoodSync(ctx: QueryCtx): Promise<Doc<"positionsSyncs"> | null> {
  const syncs = await ctx.db.query("positionsSyncs").order("desc").take(SYNCS_SEARCHED_MOST);
  const good = syncs.find((sync) => sync.outcome.ok);
  if (good !== undefined) return good;
  if (syncs.length === SYNCS_SEARCHED_MOST) throw new Error(`None of the newest ${SYNCS_SEARCHED_MOST} positions syncs read its starts`);
  return null;
}

function settingsRow(ctx: QueryCtx) {
  return ctx.db.query("positionSettings").unique();
}

async function saveSettings(ctx: MutationCtx, changes: Partial<Omit<Doc<"positionSettings">, "_id" | "_creationTime">>) {
  const settings = await settingsRow(ctx);
  if (settings === null) await ctx.db.insert("positionSettings", { approveMode: FIRST_APPROVE_MODE, ...changes });
  else await ctx.db.patch("positionSettings", settings._id, changes);
}
