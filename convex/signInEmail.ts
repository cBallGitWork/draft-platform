import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";

// The sign-in email, sent through Resend's API (ARCHITECTURE.md, Services). Convex Auth calls
// `sendSignInEmail` once it has made the link; signInLinks.ts says why it first takes an ask.

export const RESEND_EMAILS_URL = "https://api.resend.com/emails";
/** Resend's own test sender, which reaches only the Resend account's own address, until the app
 *  has a sending domain. "Draft Manager" is the placeholder name (src/product.ts). */
const FROM = "Draft Manager <onboarding@resend.dev>";

/** Wording for Craig to change in the pull request (spec/02). */
export function signInEmail(url: string) {
  return {
    subject: "Your link to sign in to Draft Manager",
    text: [
      "Here is your link to sign in to Draft Manager:",
      "",
      url,
      "",
      "It works once, within an hour, on any device. If you didn't ask for it, you can ignore this email.",
    ].join("\n"),
  };
}

/** Convex Auth's `sendVerificationRequest`. It hands over the action's ctx as an untyped second
 *  argument, so its absence is an error here rather than a send skipped. */
export async function sendSignInEmail({ identifier, url }: { identifier: string; url: string }, ctx?: ActionCtx) {
  if (!ctx) throw new Error("Convex Auth didn't pass its ctx to the sign-in email's send");
  const claimed: boolean = await ctx.runMutation(internal.signInLinks.claimSend, { email: identifier });
  if (!claimed) throw new Error(`No ask let ${identifier} through: a sign-in link is sent only by signInLinks:ask`);

  const apiKey = process.env.AUTH_RESEND_KEY;
  if (!apiKey) throw new Error("AUTH_RESEND_KEY isn't set on this deployment, so no email can be sent");
  const response = await fetch(RESEND_EMAILS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: identifier, ...signInEmail(url) }),
  });
  if (!response.ok) throw new Error(`Resend refused the email (${response.status}): ${await response.text()}`);
}
