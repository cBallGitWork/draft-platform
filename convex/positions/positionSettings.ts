import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { leagueDeadlinesIn, scheduledMatches } from "../gameweeks/leagueDeadlines";
import { LEAGUES_STORED_MOST, takeAllOrThrow } from "../shared/cappedRead";
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

/** Whose deadlines a position change counts from (spec/06, When positions change): one league's
 *  own, or, for what no one league owns (the admin's queue, each player's stars), every league's,
 *  so a change shows there once it counts in any league. */
export type PositionsFor = Id<"leagues"> | typeof EVERY_LEAGUE;
export const EVERY_LEAGUE = "every league";

/** Each request's answers, so a query asking for many teams or players works the cut-off out once
 *  per league, not once per call: a request's ctx lives only as long as it does. */
const answeredIn = new WeakMap<QueryCtx, Map<PositionsFor, Promise<HowPositionsCount>>>();

export function howPositionsCount(ctx: QueryCtx, positionsFor: PositionsFor): Promise<HowPositionsCount> {
  let answers = answeredIn.get(ctx);
  if (answers === undefined) answeredIn.set(ctx, (answers = new Map()));
  let answer = answers.get(positionsFor);
  if (answer === undefined) answers.set(positionsFor, (answer = workedOut(ctx, positionsFor)));
  return answer;
}

async function workedOut(ctx: QueryCtx, positionsFor: PositionsFor): Promise<HowPositionsCount> {
  const settings = await settingsRow(ctx);
  return {
    approveMode: settings?.approveMode ?? FIRST_APPROVE_MODE,
    thresholds: thresholdsOf(settings),
    judgedBefore: await judgedBefore(ctx, positionsFor),
  };
}

function thresholdsOf(settings: Doc<"positionSettings"> | null): ChangeThresholds {
  return {
    flagAfter: settings?.flagAfter ?? FIRST_THRESHOLDS.flagAfter,
    removeAfter: settings?.removeAfter ?? FIRST_THRESHOLDS.removeAfter,
  };
}

/** Positions change only between gameweeks (spec/06): the starts judged are those before the last
 *  of the league's own deadlines the newest good positions sync ran after, so a sync within a
 *  gameweek moves nothing. Never FPL's deadline: "we never use fpl deadline, thats their game"
 *  (Craig, 1 Nov 2026; #895), so a player's positions can differ between leagues until each has
 *  passed its deadline. The sync's time stands in for the clock, which a query can't read. Null,
 *  judging every start, before any sync or the league's first deadline (docs/positions.md, When
 *  positions change). For every league, the latest any of them has passed. */
async function judgedBefore(ctx: QueryCtx, positionsFor: PositionsFor): Promise<number | null> {
  const newestSync = await newestGoodSync(ctx);
  if (newestSync === null) return null;
  const leagueIds = positionsFor === EVERY_LEAGUE ? await everyLeagueId(ctx) : [positionsFor];
  const matches = await scheduledMatches(ctx);
  const passed: number[] = [];
  for (const leagueId of leagueIds) {
    for (const deadline of (await leagueDeadlinesIn(ctx, leagueId, matches)).values()) {
      if (deadline !== null && deadline <= newestSync.ranAt) passed.push(deadline);
    }
  }
  return passed.length === 0 ? null : Math.max(...passed);
}

async function everyLeagueId(ctx: QueryCtx): Promise<Id<"leagues">[]> {
  const leagues = await takeAllOrThrow(ctx.db.query("leagues"), LEAGUES_STORED_MOST, `More than ${LEAGUES_STORED_MOST} leagues are held, so a position change could be judged at the wrong deadline`);
  return leagues.map(({ _id }) => _id);
}

/** How many of the newest positions syncs are looked through for one that read its starts: the
 *  sync is run by hand for now, and even run daily, a thousand failing in a row is years of a feed
 *  nobody fixed. Past it this throws rather than judge every start as if none had run (#214). */
export const SYNCS_SEARCHED_MOST = 1000;

/** The newest sync that read its starts: a failed one read nothing, so it moves no boundary. Reads
 *  newest first and stops at the first good one, so it usually reads a single row. */
async function newestGoodSync(ctx: QueryCtx): Promise<Doc<"positionsSyncs"> | null> {
  let read = 0;
  for await (const sync of ctx.db.query("positionsSyncs").order("desc")) {
    if (sync.outcome.ok) return sync;
    read += 1;
    if (read === SYNCS_SEARCHED_MOST) throw new Error(`None of the newest ${SYNCS_SEARCHED_MOST} positions syncs read its starts`);
  }
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
