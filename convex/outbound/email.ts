import { PRODUCT_NAME } from "../shared/product";
import { RESEND_API_URL } from "./resend";
import { EMAIL_FROM_SETTING, TEST_SENDER } from "./sender";

// The app's emails go out through Resend's API (ARCHITECTURE.md, Services).

/** Where Resend takes an email to send. */
export const RESEND_EMAILS_URL = `${RESEND_API_URL}/emails`;
/** Who the emails come from: the deployment's own sender, or Resend's test sender where it has none
 *  (sender.ts). */
function sender(): string {
  return `${PRODUCT_NAME} <${process.env[EMAIL_FROM_SETTING] || TEST_SENDER}>`;
}

/** Sends one email, or throws saying why it wasn't sent. Every email the app sends goes through
 *  here, and counts nothing: the caller counts it first, against the day's limit (emailLimit.ts). */
export async function sendEmail(to: string, words: { subject: string; text: string }) {
  const apiKey = process.env.AUTH_RESEND_KEY;
  if (!apiKey) throw new Error("AUTH_RESEND_KEY isn't set on this deployment, so no email can be sent");
  const response = await fetch(RESEND_EMAILS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: sender(), to, ...words }),
  });
  if (!response.ok) throw new Error(`Resend refused the email (${response.status}): ${await response.text()}`);
}
