import { expect, test, vi } from "vitest";
import { replyWords } from "../../src/signIn/words";
import { LINK_LIFETIME_S } from "../../convex/auth";
import { inviteEmail } from "../../convex/joining/joiningEmails";
import { signInEmail } from "../../convex/signIn/signInEmail";
import { HOUR_MS } from "../../convex/shared/time";

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
