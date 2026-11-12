import { expect, test, vi } from "vitest";
import { RESEND_EMAILS_URL, sendEmail } from "../../../convex/outbound/email";
import { EMAIL_FROM_SETTING } from "../../../convex/outbound/deploymentSettings";
import { TEST_SENDER } from "../../../convex/outbound/sender";
import { PRODUCT_NAME } from "../../../convex/shared/product";

const LIVE_SENDER = "signin@example.co.uk";
const WORDS = { subject: "Your link", text: "Open it" };

/** Sends one email to a faked Resend and gives back who it said the email was from. */
async function sentFrom(): Promise<string> {
  vi.stubEnv("AUTH_RESEND_KEY", "re_test_key");
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ id: "email-id" }));
  vi.stubGlobal("fetch", fetchMock);
  await sendEmail("someone@example.com", WORDS);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe(RESEND_EMAILS_URL);
  return JSON.parse(String(init.body)).from;
}

test("a deployment with no sender of its own sends from Resend's test sender", async () => {
  expect(await sentFrom()).toBe(`${PRODUCT_NAME} <${TEST_SENDER}>`);
});

test("a deployment with a sender sends from it (spec/20, The live site)", async () => {
  vi.stubEnv(EMAIL_FROM_SETTING, LIVE_SENDER);
  expect(await sentFrom()).toBe(`${PRODUCT_NAME} <${LIVE_SENDER}>`);
});
