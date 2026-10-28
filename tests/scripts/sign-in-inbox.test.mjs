// scripts/sign-in-inbox.mjs, the after-release check's inbox, against a faked Resend receiving API.

import { expect, test } from "vitest";
import { CLOCK_SKEW_MS, RECEIVED_PATH, linkIn, newestMatch, receivedSignInLink } from "../../scripts/sign-in-inbox.mjs";

const SITE = "https://site.example";
const TO = "check@abc.resend.app";
const SUBJECT = "Your link to sign in";
const ASKED_AT = Date.parse("2026-10-28T12:00:00Z");
const API = "https://resend.test";
const KEY = "re_test_key";

const at = (ms) => new Date(ms).toISOString();
const received = (id, overrides = {}) => ({ id, to: [TO], subject: SUBJECT, created_at: at(ASKED_AT + 1_000), ...overrides });

/** A faked Resend: `looks` is what each list answers in turn (the last repeats), `bodies` each
 *  email's by id. Records every URL asked and the key each ask carried. */
function fakeResend({ looks, bodies = {}, status = 200 }) {
  const asked = [];
  let look = 0;
  const fetch = async (url, { headers }) => {
    asked.push({ url, auth: headers.Authorization });
    if (status !== 200) return new Response("no", { status });
    const path = new URL(url).pathname;
    if (path === RECEIVED_PATH) return Response.json({ object: "list", has_more: false, data: looks[Math.min(look++, looks.length - 1)] });
    return Response.json(bodies[decodeURIComponent(path.slice(RECEIVED_PATH.length + 1))]);
  };
  return { fetch, asked };
}

/** A clock that moves on only when the check sleeps. */
function fakeClock() {
  let time = ASKED_AT;
  return { now: () => time, sleep: async (ms) => void (time += ms) };
}

const wait = (fake, clock = fakeClock()) =>
  receivedSignInLink({ apiKey: KEY, to: TO, subject: SUBJECT, siteUrl: SITE, since: ASKED_AT, apiUrl: API, waitMs: 20_000, pollMs: 5_000, fetch: fake.fetch, ...clock });

test("the link on the site is found in a text body, and one to another site is passed over", () => {
  const body = `Sign in:\n\nhttps://elsewhere.example/?code=1\n${SITE}/?code=123\n\nIt works once.`;
  expect(linkIn(body, SITE)).toBe(`${SITE}/?code=123`);
  expect(linkIn("no link here", SITE)).toBeNull();
  expect(linkIn(null, SITE)).toBeNull();
});

test("an HTML body's link has its &amp; undone", () => {
  expect(linkIn(`<a href="${SITE}/?code=1&amp;invite=2">Sign in</a>`, SITE)).toBe(`${SITE}/?code=1&invite=2`);
});

test("the newest email to the address with the subject counts; older than the ask, or another's, doesn't", () => {
  const emails = [
    received("old", { created_at: at(ASKED_AT - CLOCK_SKEW_MS - 1) }),
    received("other address", { to: ["someone@else.example"] }),
    received("other subject", { subject: "Draft night" }),
    received("first", { created_at: at(ASKED_AT + 1_000) }),
    received("newest", { to: [`Check <${TO.toUpperCase()}>`], created_at: at(ASKED_AT + 2_000) }),
  ];
  expect(newestMatch(emails, { to: TO, subject: SUBJECT, since: ASKED_AT })?.id).toBe("newest");
  expect(newestMatch(emails.slice(0, 3), { to: TO, subject: SUBJECT, since: ASKED_AT })).toBeNull();
});

test("it waits for the email, then reads its link, sending the key only as a bearer token", async () => {
  const fake = fakeResend({ looks: [[], [], [received("e1")]], bodies: { e1: { text: `${SITE}/?code=abc`, html: null } } });
  await expect(wait(fake)).resolves.toBe(`${SITE}/?code=abc`);
  expect(fake.asked.map(({ url }) => new URL(url).pathname)).toEqual([RECEIVED_PATH, RECEIVED_PATH, RECEIVED_PATH, `${RECEIVED_PATH}/e1`]);
  expect(fake.asked.every(({ auth, url }) => auth === `Bearer ${KEY}` && !url.includes(KEY))).toBe(true);
});

test("an email with only an HTML body gives its link", async () => {
  const fake = fakeResend({ looks: [[received("e1")]], bodies: { e1: { text: null, html: `<a href="${SITE}/?code=h">x</a>` } } });
  await expect(wait(fake)).resolves.toBe(`${SITE}/?code=h`);
});

test("no email by the deadline fails, saying so", async () => {
  const fake = fakeResend({ looks: [[received("stale", { created_at: at(ASKED_AT - CLOCK_SKEW_MS - 1) })]] });
  await expect(wait(fake)).rejects.toThrow("no sign-in email reached the check's address within 20s");
  expect(fake.asked).toHaveLength(5);
});

test("an email holding no link to the site fails, saying so", async () => {
  const fake = fakeResend({ looks: [[received("e1")]], bodies: { e1: { text: "https://elsewhere.example/?code=1", html: null } } });
  await expect(wait(fake)).rejects.toThrow(`holds no link to ${SITE}`);
});

test("Resend refusing fails with its status, never the key", async () => {
  const fake = fakeResend({ looks: [[]], status: 401 });
  const failure = await wait(fake).catch((error) => error.message);
  expect(failure).toBe(`Resend's receiving API answered 401 to ${RECEIVED_PATH}`);
  expect(failure).not.toContain(KEY);
});
