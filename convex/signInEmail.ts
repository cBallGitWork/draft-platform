// The sign-in email, sent through Resend's API (ARCHITECTURE.md, Services). Convex Auth calls
// `sendSignInEmail` once it has made the link, which only an ask lets it do (signInLinks.ts).

export const RESEND_EMAILS_URL = "https://api.resend.com/emails";
/** The placeholder name: a copy of src/product.ts's, as Convex deploys only convex/. */
const PRODUCT_NAME = "Draft Manager";
/** Resend's own test sender, which reaches only the Resend account's own address, until the app
 *  has a sending domain. */
const FROM = `${PRODUCT_NAME} <onboarding@resend.dev>`;

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

/** Convex Auth's `sendVerificationRequest`. */
export async function sendSignInEmail({ identifier, url }: { identifier: string; url: string }) {
  const apiKey = process.env.AUTH_RESEND_KEY;
  if (!apiKey) throw new Error("AUTH_RESEND_KEY isn't set on this deployment, so no email can be sent");
  const response = await fetch(RESEND_EMAILS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: identifier, ...signInEmail(url) }),
  });
  if (!response.ok) throw new Error(`Resend refused the email (${response.status}): ${await response.text()}`);
}
