import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { SECOND_MS } from "../shared/time";
import { draftOf, picksMadeIn } from "./draftRow";
import { picksAtOnce } from "./draftTimeouts";
import { pickOnTheClock } from "./snakeOrder";

// The pick clock (spec/04, The picks; #1091). Each pick runs on the league's pick time. The first
// clock starts with the draft; each after waits 10 seconds from the pick before it, whoever made it
// (Craig, 4 Nov 2026, on #1091), the window a manager has to undo his own pick (pickWindow.ts
// `undoMyPick`; #1458), and the draft ends 10 seconds after its last pick. When a clock
// runs out, the draft picks for the team (draftPicks.ts `autoPick`), whether or not its manager is
// online. A team with no manager is picked for at once, as its clock starts (Craig, 4 Nov 2026, on
// #1091), and so is a team on auto-pick past its first pick there (draftTimeouts.ts; #1136). The
// commissioner can pause and resume it (draftPause.ts; #1135). A team with no manager that the
// commissioner said "I'll pick for this one" for runs its clock, and a pick his undo put back runs
// its full clock whoever's it is (draftCommissioner.ts; #1095).

/** How long after a pick the next pick's clock starts (Craig, 4 Nov 2026: "Yes, clock waits"). */
export const PICK_GAP_MS = 10 * SECOND_MS;

/** The pick a clock was started for: its number and round, its team, when its clock starts and
 *  runs out, `atOnce` when the draft picks for the team as it starts (`picksAtClockStart`), and
 *  `paused` when the draft is paused, so the clock waits for the commissioner to resume. */
export type Clocked = { pick: number; round: number; team: Doc<"teams">; startsAt: number; endsAt: number; atOnce: boolean; paused: boolean };

/** How a clock starts besides its time: `fullClock` for a pick the commissioner's undo put back,
 *  which the draft makes only when its clock runs out; `pausedAt` for one put on the clock while
 *  the draft is paused, which schedules nothing until he resumes (draftPause.ts; #1095); `upNext`
 *  for one after a manager's own pick, whose manager is told he is up next only as it starts, once
 *  the 10 seconds to undo are up; and `leftMs` for a pick a manager's own undo put back, which runs
 *  for the time his clock had left, not the pick time (Craig, 11 Nov 2026, on #1458). */
export type ClockStart = { fullClock?: true; pausedAt?: number; upNext?: true; leftMs?: number };

/** Puts the pick after the league's first `picksMade` on the clock, from `startsAt` for
 *  `pickSeconds`, scheduling the pick the draft makes for its team, and returns it; once every pick
 *  is made, the draft ends at `startsAt`, the last pick's 10 seconds after it (Craig, 4 Nov 2026, on
 *  #1090): the clock is a closing one until then, whose job ends it (pickWindow.ts `endDraft`), and
 *  this returns null. The caller cancels any job still waiting on the clock before: never the job
 *  running now, as cancelling it would cancel what it schedules too. */
export async function startClock(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
  picksMade: number,
  startsAt: number,
  pickSeconds: number,
  { fullClock, pausedAt, upNext, leftMs }: ClockStart = {},
): Promise<Clocked | null> {
  const draft = await draftOf(ctx, leagueId);
  if (draft?.started === undefined) throw new Error(`League ${leagueId}'s draft hasn't started, so no pick can be put on the clock`);
  const paused = pausedAt === undefined ? undefined : { at: pausedAt, pickSeconds };
  const turn = pickOnTheClock(draft.started.teamIds, draft.started.rounds, picksMade, draft.tradedPicks);
  if (turn === null) {
    const closing = { pick: picksMade + 1, startsAt, endsAt: startsAt, closing: true as const };
    const job = paused === undefined ? await ctx.scheduler.runAt(startsAt, internal.draft.pickWindow.endDraft, { leagueId }) : undefined;
    await ctx.db.patch("drafts", draft._id, { clock: { ...closing, job, paused } });
    return null;
  }
  const team = await ctx.db.get("teams", turn.team);
  if (team === null) throw new Error(`League ${leagueId}'s draft names team ${turn.team}, which doesn't exist`);
  const endsAt = startsAt + (leftMs ?? pickSeconds * SECOND_MS);
  const clock = { pick: turn.pick, startsAt, endsAt, ...(fullClock && { fullClock }), ...(upNext && { upNext }) };
  if (paused !== undefined) {
    await ctx.db.patch("drafts", draft._id, { clock: { ...clock, paused } });
  } else {
    await scheduleAutoPick(ctx, draft, clock, team);
  }
  return { pick: turn.pick, round: turn.round, team, startsAt, endsAt, atOnce: picksAtClockStart(draft, clock, team), paused: paused !== undefined };
}

/** A draft's pick clock, as its row holds it. */
type Clock = NonNullable<Doc<"drafts">["clock"]>;

/** Cancels the job waiting on `clock`, if there is a clock and it has one. Never pass the clock of
 *  the job running now: cancelling it would cancel what it schedules too. */
export async function cancelClockJob(ctx: MutationCtx, clock: Pick<Clock, "job"> | undefined): Promise<void> {
  if (clock?.job !== undefined) await ctx.scheduler.cancel(clock.job);
}

/** The pick `clock` holds, in the started `draft`, as `startClock` returned it. */
export async function clockedOf(ctx: MutationCtx, draft: Doc<"drafts">, clock: Clock): Promise<Clocked> {
  const started = draft.started;
  const turn = started && pickOnTheClock(started.teamIds, started.rounds, clock.pick - 1, draft.tradedPicks);
  if (!turn) throw new Error(`League ${draft.leagueId}'s clock holds pick ${clock.pick}, which its draft doesn't have`);
  const team = await ctx.db.get("teams", turn.team);
  if (team === null) throw new Error(`League ${draft.leagueId}'s draft names team ${turn.team}, which doesn't exist`);
  const { startsAt, endsAt } = clock;
  return { pick: turn.pick, round: turn.round, team, startsAt, endsAt, atOnce: picksAtClockStart(draft, clock, team), paused: clock.paused !== undefined };
}

/** When the draft picks for `team`, whose pick is `clock`'s: as the clock starts for a team it picks
 *  for at once (draftTimeouts.ts `picksAtOnce`), unless the commissioner's undo put the pick back on
 *  its full clock, and when the clock runs out otherwise. */
export function autoPickAt(draft: Doc<"drafts">, clock: Clock, team: Doc<"teams">): number {
  return picksAtClockStart(draft, clock, team) ? clock.startsAt : clock.endsAt;
}

/** Whether the draft picks for `team` as `clock` starts rather than when it runs out: such a pick
 *  is no timeout. Claude's reading of spec/04-the-draft.md, Auto-pick: a timeout is "when his
 *  clock runs out", and a pick made at once has no clock run out (#1460). */
export function picksAtClockStart(draft: Doc<"drafts">, clock: Clock, team: Doc<"teams">): boolean {
  return picksAtOnce(draft.timeouts, team) && !clock.fullClock;
}

/** Schedules the pick the draft makes for `team`, whose pick is `clock`'s, at `autoPickAt`, and
 *  saves the job on the clock; for a clock whose manager is told he is up next only as it starts,
 *  that telling instead, as it starts, which schedules the pick then (pickWindow.ts `clockStarts`).
 *  Cancels `clock`'s job first, so a caller running as that job passes the clock without it. A
 *  paused clock schedules nothing until the commissioner resumes it. */
export async function scheduleAutoPick(ctx: MutationCtx, draft: Doc<"drafts">, clock: Clock, team: Doc<"teams">): Promise<void> {
  if (clock.paused !== undefined) return;
  await cancelClockJob(ctx, clock);
  const args = { leagueId: draft.leagueId, pick: clock.pick };
  const job = clock.upNext
    ? await ctx.scheduler.runAt(clock.startsAt, internal.draft.pickWindow.clockStarts, args)
    : await ctx.scheduler.runAt(autoPickAt(draft, clock, team), internal.draft.draftPicks.autoPick, args);
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
