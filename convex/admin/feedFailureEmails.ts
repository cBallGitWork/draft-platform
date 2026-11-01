import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, type MutationCtx } from "../_generated/server";
import { failureOf, type RunOutcome } from "./feedState";
import { sendEmail } from "../outbound/email";
import { takeTodaysEmail } from "../outbound/emailLimit";
import { FAILURE_EMAIL_NAMES, failureEmailKindValidator, type FailureEmailKind } from "../shared/feedSchedule";
import { momentIn } from "../shared/moments";
import { PRODUCT_NAME } from "../shared/product";
import { DAY_MS } from "../shared/time";
import { adminEmail } from "../signIn/allowedEmails";

// The email the admin gets when a feed or sync fails, "at most once a day for each feed" (#319,
// spec/15). Each feed's record mutation calls `emailIfFailed`, so the email follows a failure
// however the feed was run. It counts against the day's emails (emailLimit.ts); with none left
// it isn't sent, the failure is logged, and the next failure tries again.

/** How long after emailing that a feed failed before its next failure emails again. */
export const FAILURE_EMAIL_GAP_MS = DAY_MS;

/** Whether a feed's failure at `failedAt` emails the admin, given when it last did (null: never). */
export function emailsNow(lastEmailedAt: number | null, failedAt: number): boolean {
  return lastEmailedAt === null || failedAt - lastEmailedAt >= FAILURE_EMAIL_GAP_MS;
}

/** Wording for Craig to change in the pull request. */
function failureEmail(feed: FailureEmailKind, ranAt: number, error: string, zone: string | undefined) {
  const { name, source } = FAILURE_EMAIL_NAMES[feed];
  return {
    subject: `${PRODUCT_NAME}: ${name} failed`,
    text: [
      `${name}, from ${source}, failed in the run on ${momentIn(ranAt, zone)}:`,
      "",
      error,
      "",
      "The feeds page shows how it stands now. Another failure like this won't email you for a day.",
    ].join("\n"),
  };
}

/** Emails the admin, at most once a day for each kind, if this run of `feed` failed. */
export async function emailIfFailed(ctx: MutationCtx, feed: FailureEmailKind, { ranAt, outcome }: { ranAt: number; outcome: RunOutcome }) {
  const error = failureOf(outcome);
  if (error === null) return;
  const emailed = await ctx.db
    .query("feedFailureEmails")
    .withIndex("by_feed", (q) => q.eq("feed", feed))
    .unique();
  if (!emailsNow(emailed?.emailedAt ?? null, ranAt)) return;
  if (!(await takeTodaysEmail(ctx))) {
    console.error(`${feed} failed, but the day's emails are all gone, so the admin wasn't emailed: ${error}`);
    return;
  }
  if (emailed === null) await ctx.db.insert("feedFailureEmails", { feed, emailedAt: ranAt });
  else await ctx.db.patch("feedFailureEmails", emailed._id, { emailedAt: ranAt });
  await ctx.scheduler.runAfter(0, internal.admin.feedFailureEmails.send, { feed, ranAt, error });
}

export const send = internalAction({
  args: { feed: failureEmailKindValidator, ranAt: v.number(), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { feed, ranAt, error }) => {
    try {
      const admin = adminEmail();
      const zone = (await ctx.runQuery(internal.signIn.timeZone.zoneFor, { email: admin })) ?? undefined;
      await sendEmail(admin, failureEmail(feed, ranAt, error, zone));
    } catch (sendError) {
      console.error(`The email saying ${feed} failed wasn't sent to the admin:`, sendError);
    }
    return null;
  },
});
