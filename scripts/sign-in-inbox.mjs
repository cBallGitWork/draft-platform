// The after-release check's inbox (spec/20, Every release): the sign-in email the live site sent
// to the check's own address, read back through Resend's receiving API, and the link in it. The
// check (tests/live/signIn.live.spec.ts) asks the site for a link as any manager would, then waits
// here for it: the site has no test-only way in. The address is one Resend receives for the
// account, so no mailbox is needed. Nothing here prints the key or the link.

/** Resend's API (convex/outbound/email.ts sends through it too). */
export const RESEND_API_URL = "https://api.resend.com";
/** Resend's received emails: listed without bodies, then one fetched by id with its text. */
export const RECEIVED_PATH = "/emails/receiving";
/** How many of the newest received emails each look reads: the check's is among the last few. */
export const RECENT_LIMIT = 20;
/** How long the check waits for the email, and how often it looks. */
export const WAIT_MS = 2 * 60_000;
export const POLL_MS = 5_000;
/** How long before the ask a received email may be dated and still be the ask's: the runner's
 *  clock and Resend's can differ by a few seconds. */
export const CLOCK_SKEW_MS = 30_000;

/** A web address in an email's body, up to a space, a quote or a tag's bracket. */
const ADDRESSES = /https?:\/\/[^\s"'<>]+/g;

/** The first link in `body` on `siteUrl`'s site, or null; an HTML body's `&amp;` is undone first. */
export function linkIn(body, siteUrl) {
  const site = new URL(siteUrl).origin;
  const found = (body ?? "").replaceAll("&amp;", "&").match(ADDRESSES) ?? [];
  return found.find((address) => URL.canParse(address) && new URL(address).origin === site) ?? null;
}

/** Of a list of received emails, the newest to `to` with `subject`, dated no earlier than
 *  `since` less the clock skew; null if none is. Convex Auth keeps only an email's newest link. */
export function newestMatch(emails, { to, subject, since }) {
  const address = to.trim().toLowerCase();
  const matches = emails.filter(
    (email) =>
      email.subject === subject &&
      (email.to ?? []).some((recipient) => recipient.toLowerCase().includes(address)) &&
      Date.parse(email.created_at) >= since - CLOCK_SKEW_MS,
  );
  return matches.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] ?? null;
}

/** One GET of Resend's API, or a throw saying what it answered (never the key). */
async function getJson(fetch, url, apiKey) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!response.ok) throw new Error(`Resend's receiving API answered ${response.status} to ${new URL(url).pathname}`);
  return response.json();
}

/** Waits for the sign-in email asked for at `since` (ms) to reach `to`, and returns its link to
 *  `siteUrl`; throws, saying why, if none comes by the deadline or it holds no such link.
 *  `fetch`, `now`, `sleep`, `apiUrl` and the times are the tests'. */
export async function receivedSignInLink({
  apiKey,
  to,
  subject,
  siteUrl,
  since,
  fetch = globalThis.fetch,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  apiUrl = RESEND_API_URL,
  waitMs = WAIT_MS,
  pollMs = POLL_MS,
}) {
  const deadline = now() + waitMs;
  for (;;) {
    const list = await getJson(fetch, `${apiUrl}${RECEIVED_PATH}?limit=${RECENT_LIMIT}`, apiKey);
    const match = newestMatch(list.data ?? [], { to, subject, since });
    if (match) {
      const email = await getJson(fetch, `${apiUrl}${RECEIVED_PATH}/${encodeURIComponent(match.id)}`, apiKey);
      const link = linkIn(email.text, siteUrl) ?? linkIn(email.html, siteUrl);
      if (!link) throw new Error(`the sign-in email arrived, but holds no link to ${new URL(siteUrl).origin}`);
      return link;
    }
    if (now() >= deadline) throw new Error(`no sign-in email reached the check's address within ${waitMs / 1000}s`);
    await sleep(pollMs);
  }
}
