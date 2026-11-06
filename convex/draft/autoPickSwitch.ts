import { v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation } from "../_generated/server";
import { managerOf, refuse } from "../shared/leagueAccess";
import { pickRefusals } from "./draftPicks";
import { draftIsLive, draftOf } from "./draftRow";
import { afterChoosing, afterTakeBack, isOnAutoPick } from "./draftTimeouts";
import { pickOnTheClock } from "./snakeOrder";

// A manager's own auto-pick switch (spec/04, Auto-pick): he turns it on himself (#1100), or takes
// control back from it (#1094). The draft's timeouts hold which teams are on it (draftTimeouts.ts),
// and draftPicks.ts `autoPick` makes their picks.

/** A manager turns auto-pick on himself (Craig, 5 Nov 2026, on #1100): before the draft starts or
 *  while it runs. Every pick of his is then made at once, the one on the clock now too (as its clock
 *  starts, if it is still in the 10 seconds before), and his timeout count stays as it is. While
 *  the draft is paused his pick waits for the resume, and a pick the commissioner's undo put back
 *  still runs its full clock. Refused once the draft is over, and to a manager already on it. */
export const turnOn = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const { team } = await managerOf(ctx, leagueId);
    const draft = await draftOf(ctx, leagueId);
    if (draft?.started !== undefined && !(await draftIsLive(ctx, leagueId))) refuse(pickRefusals.over);
    if (draft !== null && isOnAutoPick(draft.timeouts, team._id)) refuse(pickRefusals.onAutoPick);
    const timeouts = afterChoosing(draft?.timeouts, team._id);
    if (draft === null) {
      await ctx.db.insert("drafts", { leagueId, timeouts });
      return null;
    }
    await ctx.db.patch("drafts", draft._id, { timeouts });
    const { clock, started } = draft;
    if (clock === undefined || started === undefined || clock.paused !== undefined || clock.fullClock) return null;
    if (pickOnTheClock(started.teamIds, started.rounds, clock.pick - 1)?.team !== team._id) return null;
    if (clock.job !== undefined) await ctx.scheduler.cancel(clock.job);
    const job = await ctx.scheduler.runAt(clock.startsAt, internal.draft.draftPicks.autoPick, { leagueId, pick: clock.pick });
    await ctx.db.patch("drafts", draft._id, { clock: { ...clock, job } });
    return null;
  },
});

/** A manager on auto-pick takes control back (spec/04, Auto-pick; #1094): his team is off it and
 *  his timeout count is 0 again. A pick of his already on the clock then runs to the clock's end,
 *  not made at once (draftPicks.ts `autoPick`). Refused to anyone not on auto-pick. */
export const takeControlBack = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const { team } = await managerOf(ctx, leagueId);
    const draft = await draftOf(ctx, leagueId);
    if (draft === null || !isOnAutoPick(draft.timeouts, team._id)) refuse(pickRefusals.notOnAutoPick);
    await ctx.db.patch("drafts", draft._id, { timeouts: afterTakeBack(draft.timeouts, team._id) });
    return null;
  },
});
