import { expect, test, vi } from "vitest";
import { replyWords } from "../../src/signIn/words";
import { LINK_LIFETIME_S } from "../../convex/auth";
import { inviteEmail } from "../../convex/joining/joiningEmails";
import { SIGN_IN_SUBJECT_START, signInEmail } from "../../convex/signIn/signInEmail";
import { HOUR_MS, MINUTE_MS } from "../../convex/shared/time";

// spec/02: a link lasts an hour. The words saying so live with each email and screen, so this
// keeps them in step with the lifetime Convex Auth is given.

const AN_HOUR = "within an hour";

test("a sign-in link lasts an hour, and every place that tells a person so says an hour", () => {
  expect(LINK_LIFETIME_S).toBe(HOUR_MS / 1000);
  vi.stubEnv("SITE_URL", "https://example.com");
  const url = "https://example.com/sign-in?code=1";
  expect(signInEmail(url).text).toContain(AN_HOUR);
  expect(inviteEmail(url, { leagueName: "A league", invitedBy: "Craig", teamName: null }).text).toContain(AN_HOUR);
  expect(replyWords.checkYourEmail).toContain(AN_HOUR);
});

test("two sign-in emails a minute apart have different subjects, so Gmail doesn't fold one into the other", () => {
  const url = "https://example.com/sign-in?code=1";
  const sentAt = Date.UTC(2026, 10, 1, 14, 32);
  const first = signInEmail(url, sentAt).subject;
  const next = signInEmail(url, sentAt + MINUTE_MS).subject;
  expect(first).toBe(`${SIGN_IN_SUBJECT_START}, Sunday 1 November at 14:32 GMT`);
  expect(next.startsWith(SIGN_IN_SUBJECT_START)).toBe(true);
  expect(next).not.toBe(first);
});
