import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { sendEmail } from "./email";
import { inviteIdIn } from "./joiningShared";
import { PRODUCT_NAME } from "./product";

// The sign-in email, sent through email.ts. Convex Auth calls `sendSignInEmail` once it has made
// the link, which only an ask lets it do (signInLinks.ts). The product's name is product.ts's.

/** Wording for Craig to change in the pull request (spec/02). */
export function signInEmail(url: string) {
  return {
    subject: `Your link to sign in to ${PRODUCT_NAME}`,
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
  const words = ctx && inviteId ? await ctx.runQuery(internal.invites.emailWords, { inviteId, url }) : signInEmail(url);
  await sendEmail(identifier, words);
}
