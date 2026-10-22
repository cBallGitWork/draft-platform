import { PRODUCT_NAME } from "../shared/product";

// The app's emails go out through Resend's API (ARCHITECTURE.md, Services).

export const RESEND_EMAILS_URL = "https://api.resend.com/emails";
/** Resend's own test sender, which reaches only the Resend account's own address, until the app
 *  has a sending domain. */
const FROM = `${PRODUCT_NAME} <onboarding@resend.dev>`;

/** Sends one email, or throws saying why it wasn't sent. Every email the app sends goes through
 *  here, and counts nothing: the caller counts it first, against the day's limit (emailLimit.ts). */
export async function sendEmail(to: string, words: { subject: string; text: string }) {
  const apiKey = process.env.AUTH_RESEND_KEY;
  if (!apiKey) throw new Error("AUTH_RESEND_KEY isn't set on this deployment, so no email can be sent");
  const response = await fetch(RESEND_EMAILS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, ...words }),
  });
  if (!response.ok) throw new Error(`Resend refused the email (${response.status}): ${await response.text()}`);
}
