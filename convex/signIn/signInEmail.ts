import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { sendEmail } from "../outbound/email";
import { inviteIdIn } from "../joining/joiningShared";
import { PRODUCT_NAME } from "../shared/product";
import { momentIn } from "../shared/moments";

// The sign-in email. Convex Auth calls `sendSignInEmail` once it has made the link, which only an
// ask lets it do (signInLinks.ts).

/** How every sign-in email's subject starts: the release check finds its email by it. */
export const SIGN_IN_SUBJECT_START = `Your link to sign in to ${PRODUCT_NAME}`;

/** Wording for Craig to change in the pull request (spec/02). The subject ends with when it was
 *  sent, so Gmail never folds a new link into the conversation of an earlier one. */
export function signInEmail(url: string, sentAt = Date.now()) {
  return {
    subject: `${SIGN_IN_SUBJECT_START}, ${momentIn(sentAt, undefined)}`,
    text: [
      `Here is your link to sign in to ${PRODUCT_NAME}:`,
      "",
      url,
      "",
      "It works once, within an hour, on any device. If you didn't ask for it, you can ignore this email.",
    ].join("\n"),
  };
}

/** Convex Auth's `sendVerificationRequest`, which it hands its action's `ctx` too: an invite's
 *  link goes in the invite's own email (#73). */
export async function sendSignInEmail({ identifier, url }: { identifier: string; url: string }, ctx?: ActionCtx) {
  const inviteId = inviteIdIn(url);
  const words = ctx && inviteId ? await ctx.runQuery(internal.joining.invites.emailWords, { inviteId, url }) : signInEmail(url);
  await sendEmail(identifier, words);
}
