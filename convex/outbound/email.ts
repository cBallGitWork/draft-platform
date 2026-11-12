import { PRODUCT_NAME } from "../shared/product";
import { momentIn } from "../shared/moments";
import { RESEND_API_URL } from "./resend";
import { EMAIL_FROM_SETTING, RESEND_KEY_SETTING } from "./deploymentSettings";
import { TEST_SENDER } from "./sender";

// The app's emails go out through Resend's API (ARCHITECTURE.md, Services).

/** Where Resend takes an email to send. */
export const RESEND_EMAILS_URL = `${RESEND_API_URL}/emails`;
/** Who the emails come from: the deployment's own sender, or Resend's test sender where it has none
 *  (sender.ts). */
function sender(): string {
  return `${PRODUCT_NAME} <${process.env[EMAIL_FROM_SETTING] || TEST_SENDER}>`;
}

/** `subject` ending with when it was sent, so Gmail never folds a new email into the conversation of
 *  an earlier one with the same subject: a sign-in link, a resent invite (#973), a second approval
 *  into the same league (#1052). */
export function datedSubject(subject: string, sentAt: number): string {
  return `${subject}, ${momentIn(sentAt, undefined)}`;
}

/** Sends one email, or throws saying why it wasn't sent. Every email the app sends goes through
 *  here, and counts nothing: the caller counts it first, against the day's limit (emailLimit.ts). */
export async function sendEmail(to: string, words: { subject: string; text: string }) {
  const apiKey = process.env[RESEND_KEY_SETTING];
  if (!apiKey) throw new Error(`${RESEND_KEY_SETTING} isn't set on this deployment, so no email can be sent`);
  const response = await fetch(RESEND_EMAILS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: sender(), to, ...words }),
  });
  if (!response.ok) throw new Error(`Resend refused the email (${response.status}): ${await response.text()}`);
}
