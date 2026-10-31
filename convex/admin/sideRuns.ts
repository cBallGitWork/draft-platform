import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type ActionCtx } from "../_generated/server";
import { emailIfFailed } from "./feedFailureEmails";
import { FEED_RUN_TABLES, sideFeedValidator } from "../shared/feedSchedule";
import { sideMatchOutcome, sideRunFields } from "../schema";

// The live tick's side reads (#522): the team sheets before kickoff, and each match's team stats
// and threshold steps. Each is a feed of its own on the feeds page, so a read that fails every time
// is seen there and emails the admin, as any feed's does (#319), where once it was only logged.
// Each never throws, so a failure never stops a match's points: it hands back its matches'
// outcomes, and the run that read them records the row here.

export type SideMatchOutcome = Infer<typeof sideMatchOutcome>;
export type SideRunOutcome = Infer<typeof sideRunFields.outcome>;

/** How a run's matches went, for each side read done match by match. */
export type SideMatches = { teamStats: SideMatchOutcome[]; thresholdSteps: SideMatchOutcome[] };

/** Each of `sides`' feeds' row for a run at `ranAt`. A run with no match for one writes its row
 *  only with `evenEmpty`: the live tick does, as a match live owes each a row a tick. */
export async function recordSideMatches(ctx: ActionCtx, ranAt: number, sides: Partial<SideMatches>, evenEmpty: boolean): Promise<void> {
  for (const [feed, matches] of Object.entries(sides) as [keyof SideMatches, SideMatchOutcome[]][]) {
    if (matches.length === 0 && !evenEmpty) continue;
    await ctx.runMutation(internal.admin.sideRuns.record, { feed, ranAt, outcome: { ok: true, matches } });
  }
}

/** One run of a side read, recorded as its own feed's row, and the admin emailed if it failed. */
export const record = internalMutation({
  args: { feed: sideFeedValidator, ...sideRunFields },
  returns: v.null(),
  handler: async (ctx, { feed, ...row }) => {
    await ctx.db.insert(FEED_RUN_TABLES[feed], row);
    await emailIfFailed(ctx, feed, row);
    return null;
  },
});
