import type { OptionalRestArgs, SchedulableFunctionReference, Scheduler } from "convex/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { DAY_MS } from "../shared/time";

// The day's email limit. Every email the app sends counts against it: sign-in links
// (signInLinks.ts), joining's (joinRequests.ts), the deletion notices (deletionNotices.ts) and the
// admin's feed failure emails (admin/feedFailureEmails.ts).
// Each is counted before it is sent, so two sends at once can't both take the day's last email;
// one that then fails stays counted, as Resend may have counted it too. One that finds none left
// waits for tomorrow (waitForTomorrow) or is dropped, as its caller decides.

/** Resend's free plan (ARCHITECTURE.md, Services): every email the app sends counts. */
export const EMAILS_PER_DAY = 100;

/** How long an ISO time's date is: "2026-10-20". */
const ISO_DATE_LENGTH = 10;

/** The UTC day a time falls on, as Resend's daily limit is counted here: "2026-10-20". */
export function dayOf(time: number): string {
  return new Date(time).toISOString().slice(0, ISO_DATE_LENGTH);
}

/** The start of the UTC day after `time`'s, when Resend's daily limit starts again. */
export function startOfNextDay(time: number): number {
  return Date.parse(dayOf(time)) + DAY_MS;
}

/** Runs `fn` with `args` again at the start of tomorrow, when the day's emails start again: for a
 *  send that found none left today. The job is saved with `fn`'s path, so renaming `fn` is its own
 *  pull request (docs/REFACTORING.md, Function paths). */
export function waitForTomorrow<Fn extends SchedulableFunctionReference>(scheduler: Scheduler, fn: Fn, ...args: OptionalRestArgs<Fn>) {
  return scheduler.runAt(startOfNextDay(Date.now()), fn, ...args);
}

function sentToday(ctx: QueryCtx) {
  return ctx.db
    .query("emailSends")
    .withIndex("by_day", (q) => q.eq("day", dayOf(Date.now())))
    .unique();
}

/** Whether today has an email left, counting nothing. */
export async function anEmailLeftToday(ctx: QueryCtx): Promise<boolean> {
  return ((await sentToday(ctx))?.count ?? 0) < EMAILS_PER_DAY;
}

/** Counts one more of today's emails, whether or not one was left: for a caller that has just
 *  checked, with `anEmailLeftToday`, in the same mutation. */
export async function countTodaysEmail(ctx: MutationCtx): Promise<void> {
  const sent = await sentToday(ctx);
  if (sent) await ctx.db.patch("emailSends", sent._id, { count: sent.count + 1 });
  else await ctx.db.insert("emailSends", { day: dayOf(Date.now()), count: 1 });
}

/** Counts one more of today's emails; false, counting nothing, when the day's are all gone. */
export async function takeTodaysEmail(ctx: MutationCtx): Promise<boolean> {
  if (!(await anEmailLeftToday(ctx))) return false;
  await countTodaysEmail(ctx);
  return true;
}
