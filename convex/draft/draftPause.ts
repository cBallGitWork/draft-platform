import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, type QueryCtx } from "../_generated/server";
import { refuse, runnerOf } from "../shared/leagueAccess";
import { SECOND_MS } from "../shared/time";
import { startClock } from "./draftClock";
import { tellPaused } from "./draftLetters";
import { pickRefusals, pickSecondsNow } from "./draftPicks";
import { draftOf, draftIsLive } from "./draftRow";

// Pausing and resuming the draft (spec/04, The commissioner; #1135). The commissioner pauses and
// resumes it by hand, as often and for as long as he likes (Craig, 2 Nov 2026). A pause keeps the
// time left on the clock, and the 10 seconds before the next clock starts freeze too (Craig, 4 Nov
// 2026, on #1091: "ok"): no pick is made, by a manager or the draft, until he resumes. If the
// league's pick time has changed while it was paused, the pick on the clock restarts on the full
// new time when it resumes (Craig, 4 Nov 2026, on #1135: "90s with 30s left, changed to 60s: it
// resumes on 60s"). A pause sends the whole league a letter, a resume none (Craig, 4 Nov 2026, on
// #1102; draftLetters.ts).

/** Why a pause or a resume is refused, in the words the commissioner is shown. */
export const pauseRefusals = {
  notStarted: pickRefusals.notStarted,
  over: pickRefusals.over,
  alreadyPaused: "The draft is already paused.",
  notPaused: "The draft isn't paused.",
};

type Clock = NonNullable<Doc<"drafts">["clock"]>;

/** The league's live draft and its clock, or the refusal: it hasn't started, or it is over. */
async function liveClock(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<{ draft: Doc<"drafts">; clock: Clock }> {
  const draft = await draftOf(ctx, leagueId);
  if (draft?.started === undefined) refuse(pauseRefusals.notStarted);
  if (!(await draftIsLive(ctx, leagueId)) || draft.clock === undefined) refuse(pauseRefusals.over);
  return { draft, clock: draft.clock };
}

/** The commissioner pauses the draft: the pick on the clock keeps its time left, and nothing is
 *  picked until he resumes. Refused to anyone who doesn't run the league, before the draft starts,
 *  once it is over and while it is already paused. */
export const pause = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const { email, league } = await runnerOf(ctx, leagueId);
    const { draft, clock } = await liveClock(ctx, leagueId);
    if (clock.paused !== undefined) refuse(pauseRefusals.alreadyPaused);
    if (clock.job !== undefined) await ctx.scheduler.cancel(clock.job);
    const paused = { at: Date.now(), pickSeconds: await pickSecondsNow(ctx, leagueId) };
    await ctx.db.patch("drafts", draft._id, { clock: { ...clock, job: undefined, paused } });
    await tellPaused(ctx, league, email);
    return null;
  },
});

/** The commissioner resumes the draft: the clock runs on from where he paused it, every moment it
 *  had left moved on by the pause, or, if the league's pick time changed while it was paused, the
 *  pick on the clock restarts on the full new time once any of its 10 seconds' wait still left has
 *  run. Refused to anyone who doesn't run the league, and while the draft isn't paused. */
export const resume = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    await runnerOf(ctx, leagueId);
    const { clock } = await liveClock(ctx, leagueId);
    if (clock.paused === undefined) refuse(pauseRefusals.notPaused);
    const now = Date.now();
    const pickSeconds = await pickSecondsNow(ctx, leagueId);
    const moved = now - clock.paused.at;
    const startsAt = clock.startsAt + moved;
    if (pickSeconds === clock.paused.pickSeconds) {
      await startClock(ctx, leagueId, clock.pick - 1, startsAt, (clock.endsAt - clock.startsAt) / SECOND_MS);
    } else {
      await startClock(ctx, leagueId, clock.pick - 1, Math.max(startsAt, now), pickSeconds);
    }
    return null;
  },
});
