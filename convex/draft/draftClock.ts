import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { SECOND_MS } from "../shared/time";
import { draftOf, picksMadeIn } from "./draftRow";
import { picksAtOnce } from "./draftTimeouts";
import { pickOnTheClock } from "./snakeOrder";

// The pick clock (spec/04, The picks; #1091). Each pick runs on the league's pick time. The first
// clock starts with the draft; each after waits 10 seconds from the pick before it, whoever made it
// (Craig, 4 Nov 2026, on #1091), the window a manager will have to undo his own pick. When a clock
// runs out, the draft picks for the team (draftPicks.ts `autoPick`), whether or not its manager is
// online. A team with no manager is picked for at once, as its clock starts (Craig, 4 Nov 2026, on
// #1091), and so is a team on auto-pick past its first pick there (draftTimeouts.ts; #1136). The
// commissioner can pause and resume it (draftPause.ts; #1135). A team with no manager that the
// commissioner said "I'll pick for this one" for runs its clock, and a pick his undo put back runs
// its full clock whoever's it is (draftCommissioner.ts; #1095).

/** How long after a pick the next pick's clock starts (Craig, 4 Nov 2026: "Yes, clock waits"). */
export const PICK_GAP_MS = 10 * SECOND_MS;

/** The pick a clock was started for: its number and round, its team, and when its clock starts and
 *  runs out. */
export type Clocked = { pick: number; round: number; team: Doc<"teams">; startsAt: number; endsAt: number };

/** How a clock starts besides its time: `fullClock` for a pick the commissioner's undo put back,
 *  which the draft makes only when its clock runs out, and `pausedAt` for one put on the clock while
 *  the draft is paused, which schedules nothing until he resumes (draftPause.ts; #1095). */
export type ClockStart = { fullClock?: true; pausedAt?: number };

/** Puts the pick after the league's first `picksMade` on the clock, from `startsAt` for
 *  `pickSeconds`, scheduling the pick the draft makes for its team, and returns it; once every pick
 *  is made, takes the clock away and returns null. The caller cancels any job still waiting on the
 *  clock before: never the job running now, as cancelling it would cancel what it schedules too. */
export async function startClock(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
  picksMade: number,
  startsAt: number,
  pickSeconds: number,
  { fullClock, pausedAt }: ClockStart = {},
): Promise<Clocked | null> {
  const draft = await draftOf(ctx, leagueId);
  if (draft?.started === undefined) throw new Error(`League ${leagueId}'s draft hasn't started, so no pick can be put on the clock`);
  const turn = pickOnTheClock(draft.started.teamIds, draft.started.rounds, picksMade, draft.tradedPicks);
  if (turn === null) {
    await ctx.db.patch("drafts", draft._id, { clock: undefined });
    return null;
  }
  const team = await ctx.db.get("teams", turn.team);
  if (team === null) throw new Error(`League ${leagueId}'s draft names team ${turn.team}, which doesn't exist`);
  const endsAt = startsAt + pickSeconds * SECOND_MS;
  const clock = { pick: turn.pick, startsAt, endsAt, ...(fullClock && { fullClock }) };
  if (pausedAt !== undefined) {
    await ctx.db.patch("drafts", draft._id, { clock: { ...clock, paused: { at: pausedAt, pickSeconds } } });
  } else {
    await scheduleAutoPick(ctx, draft, clock, team);
  }
  return { pick: turn.pick, round: turn.round, team, startsAt, endsAt };
}

/** A draft's pick clock, as its row holds it. */
type Clock = NonNullable<Doc<"drafts">["clock"]>;

/** When the draft picks for `team`, whose pick is `clock`'s: as the clock starts for a team it picks
 *  for at once (draftTimeouts.ts `picksAtOnce`), unless the commissioner's undo put the pick back on
 *  its full clock, and when the clock runs out otherwise. */
export function autoPickAt(draft: Doc<"drafts">, clock: Clock, team: Doc<"teams">): number {
  return picksAtOnce(draft.timeouts, team) && !clock.fullClock ? clock.startsAt : clock.endsAt;
}

/** Schedules the pick the draft makes for `team`, whose pick is `clock`'s, at `autoPickAt`, and
 *  saves the job on the clock. Cancels `clock`'s job first, so a caller running as that job passes
 *  the clock without it. A paused clock schedules nothing until the commissioner resumes it. */
export async function scheduleAutoPick(ctx: MutationCtx, draft: Doc<"drafts">, clock: Clock, team: Doc<"teams">): Promise<void> {
  if (clock.paused !== undefined) return;
  if (clock.job !== undefined) await ctx.scheduler.cancel(clock.job);
  const job = await ctx.scheduler.runAt(autoPickAt(draft, clock, team), internal.draft.draftPicks.autoPick, { leagueId: draft.leagueId, pick: clock.pick });
  await ctx.db.patch("drafts", draft._id, { clock: { ...clock, job } });
}

/** When `team`'s pick is on the clock in its league's draft, schedules its auto-pick again, for a
 *  team whose rule just changed: its manager turned auto-pick on (autoPickSwitch.ts; #1100), or it
 *  lost its manager, when nobody can pick for it and the draft picks at once (Craig, 8 Nov 2026:
 *  "Auto-pick at once"; #1334). `draft` is the row as it is now, timeouts included. */
export async function rescheduleIfOnTheClock(ctx: MutationCtx, draft: Doc<"drafts">, team: Doc<"teams">): Promise<void> {
  const { clock, started } = draft;
  if (clock === undefined || started === undefined) return;
  const turn = pickOnTheClock(started.teamIds, started.rounds, await picksMadeIn(ctx, draft.leagueId), draft.tradedPicks);
  if (turn?.pick !== clock.pick || turn.team !== team._id) return;
  await scheduleAutoPick(ctx, draft, clock, team);
}
