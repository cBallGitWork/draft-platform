import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { datedSubject, sendEmail } from "../outbound/email";
import { inviteIdIn } from "../joining/joiningShared";
import { PRODUCT_NAME } from "../shared/product";
import { hoursWords } from "../shared/time";
import { LINK_LIFETIME_MS } from "./signInLimits";

// The sign-in email. Convex Auth calls `sendSignInEmail` once it has made the link, which only an
// ask lets it do (signInLinks.ts).

/** How every sign-in email's subject starts: the release check finds its email by it. */
export const SIGN_IN_SUBJECT_START = `Your link to sign in to ${PRODUCT_NAME}`;

/** What a sign-in link does, as its email and an invite's say it after "It" or "The link". */
export const LINK_WORKS_WORDS = `works once, within ${hoursWords(LINK_LIFETIME_MS)}, on any device`;

/** Wording for Craig to change in the pull request (spec/02). */
export function signInEmail(url: string, sentAt = Date.now()) {
  return {
    subject: datedSubject(SIGN_IN_SUBJECT_START, sentAt),
    text: [
      `Here is your link to sign in to ${PRODUCT_NAME}:`,
      "",
      url,
      "",
      `It ${LINK_WORKS_WORDS}. If you didn't ask for it, you can ignore this email.`,
    ].join("\n"),
  };
}

/** Convex Auth's `sendVerificationRequest`, which it hands its action's `ctx` too: an invite's
 *  link goes in the invite's own email (#73). */
export async function sendSignInEmail({ identifier, url }: { identifier: string; url: string }, ctx?: ActionCtx) {
  const inviteId = inviteIdIn(url);
  const sentAt = Date.now();
  const words = ctx && inviteId ? await ctx.runQuery(internal.joining.invites.emailWords, { inviteId, url, sentAt }) : signInEmail(url, sentAt);
  await sendEmail(identifier, words);
}
