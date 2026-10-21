import type { MutationCtx, QueryCtx } from "../_generated/server";

// The day's email limit. Every email the app sends counts against it: sign-in links
// (signInLinks.ts), joining's (joinRequests.ts) and the deletion notices (deletionNotices.ts).
// Each is counted before it is sent, so two sends at once can't both take the day's last email;
// one that then fails stays counted, as Resend may have counted it too.

/** Resend's free plan (ARCHITECTURE.md, Services): every email the app sends counts. */
export const EMAILS_PER_DAY = 100;

/** The UTC day a time falls on, as Resend's daily limit is counted here: "2026-10-20". */
export function dayOf(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
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
