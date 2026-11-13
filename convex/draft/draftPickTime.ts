import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { draftRulesOf } from "../rules/firstRules";
import type { DraftRules } from "../rules/leagueRulesShape";
import { latestRules } from "../rules/rulesHistory";
import { refuse } from "../shared/leagueAccess";
import { draftIsLive, draftOf, OLD_DRAFTS_BACKFILL_HINT } from "./draftRow";

// The draft's pick time while it is live (spec/04, The commissioner; #1095). A change to the
// league's pick time waits for the next gameweek like any rules change, so the draft keeps its own:
// a change made while the draft is paused, from the draft room's box (draftCommissioner.ts) or
// League settings, reaches this draft at once and League settings too; while the draft runs
// unpaused the pick time can't be changed (Craig, 5 Nov 2026). The pick on the clock restarts on
// the full new time when it resumes (draftPause.ts; #1135).

/** Why a change of pick time is refused, in the words the commissioner is shown. */
export const pickTimeRefusals = {
  running: "The pick time can't be changed while the draft is running. Pause it first.",
  notPaused: "The draft room's pick time can be changed only while the draft is paused, or before it starts.",
};

/** The league's draft rules now, its latest, a change waiting for a later gameweek among them: a
 *  change the commissioner makes reaches the next clock, and a mid-season draft runs on the timeout
 *  limit and undrafted-players setting last typed (Craig, 10 Nov 2026, on #1439: "Last typed"). */
export const draftRulesNow = async (ctx: QueryCtx, leagueId: Id<"leagues">) => draftRulesOf(await latestRules(ctx, leagueId));

/** The pick time of `draft` under the league's latest `draftRules`, in seconds: the one it started
 *  on, or the commissioner set since while it was paused, which reaches it at once
 *  (draftCommissioner.ts; #1095); for a draft not started, the latest rules'. The clock, the board
 *  and the commissioner's box all read it (#1572). */
export function pickSecondsOf(draft: Doc<"drafts"> | null, draftRules: DraftRules): number {
  if (draft?.started === undefined) return draftRules.pickSeconds;
  if (draft.pickSeconds === undefined) throw new Error(`League ${draft.leagueId}'s draft kept no pick time: ${OLD_DRAFTS_BACKFILL_HINT}`);
  return draft.pickSeconds;
}

/** The draft's pick time now, in seconds (`pickSecondsOf`). */
export async function pickSecondsNow(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<number> {
  return pickSecondsOf(await draftOf(ctx, leagueId), await draftRulesNow(ctx, leagueId));
}

/** Whether the league's draft is live and paused. */
export async function draftIsPaused(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<boolean> {
  return (await draftIsLive(ctx, leagueId)) && (await draftOf(ctx, leagueId))?.clock?.paused !== undefined;
}

/** The league's pick time is changing to `pickSeconds`: refused while its draft runs unpaused, and
 *  while it is paused the draft takes it at once. Before the draft starts and once it is over, the
 *  change is League settings' alone. */
export async function pickTimeChanging(ctx: MutationCtx, leagueId: Id<"leagues">, pickSeconds: number): Promise<void> {
  if (!(await draftIsLive(ctx, leagueId))) return;
  if (!(await draftIsPaused(ctx, leagueId))) refuse(pickTimeRefusals.running);
  const draft = await draftOf(ctx, leagueId);
  if (draft !== null) await ctx.db.patch("drafts", draft._id, { pickSeconds });
}
