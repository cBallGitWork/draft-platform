// The addresses the app, the setup command and the after-release check call at Resend, pinned so
// a change to them is a choice, not an accident.
import { expect, test } from "vitest";
import { RESEND_EMAILS_URL } from "../../../convex/outbound/email";
import { RESEND_API_URL } from "../../../convex/outbound/resend";

test("everything calls Resend's API at api.resend.com, and the app sends its emails to /emails", () => {
  expect(RESEND_API_URL).toBe("https://api.resend.com");
  expect(RESEND_EMAILS_URL).toBe("https://api.resend.com/emails");
});
