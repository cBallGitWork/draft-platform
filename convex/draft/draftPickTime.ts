import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { refuse } from "../shared/leagueAccess";
import { draftIsLive, draftOf } from "./draftRow";

// The draft's pick time while it is live (spec/04, The commissioner; #1095). A change to the
// league's pick time waits for the next gameweek like any rules change, so the draft keeps its own:
// a change made while the draft is paused, from the draft room's box (draftCommissioner.ts) or
// League settings, reaches this draft at once and League settings too; while the draft runs
// unpaused the pick time can't be changed (Craig, 5 Nov 2026). The pick on the clock restarts on
// the full new time when it resumes (draftPause.ts; #1135).

/** Why a change of pick time is refused, in the words the commissioner is shown. */
export const pickTimeRefusals = {
  running: "The pick time can't be changed while the draft is running. Pause it first.",
  notPaused: "The draft room's pick time can be changed only while the draft is paused.",
};

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
