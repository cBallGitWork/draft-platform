import { expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { LEAD_DISPATCH_URL, LEAD_REF } from "../../../convex/heartbeats/leadWake";
import { LEAD_WAKE_TOKEN_SETTING } from "../../../convex/outbound/deploymentSettings";
import { freshConvex } from "../../support/convex/test.harness";

// The lead's wake-up (Craig, 7 Nov 2026): every half hour the live site asks GitHub to run lead.yml
// on main, since GitHub's own schedule drops passes. Development, with no token, asks nothing.

/** A fetch that answers every request with `status`, recording each. */
function github(status = 204, body = "") {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(status === 204 ? null : body, { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

test("with no token set, the wake-up asks GitHub nothing", async () => {
  vi.stubEnv(LEAD_WAKE_TOKEN_SETTING, "");
  const fetch = github();
  await freshConvex().action(internal.heartbeats.leadWake.wake, {});
  expect(fetch).not.toHaveBeenCalled();
});

test("with a token, it asks GitHub to run the lead on main, as the token's account", async () => {
  vi.stubEnv(LEAD_WAKE_TOKEN_SETTING, "github-token");
  const fetch = github();
  await freshConvex().action(internal.heartbeats.leadWake.wake, {});
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, init] = fetch.mock.calls[0];
  expect(url).toBe(LEAD_DISPATCH_URL);
  expect(url).toMatch(/\/actions\/workflows\/lead\.yml\/dispatches$/);
  expect(init?.method).toBe("POST");
  expect((init?.headers as Record<string, string>).authorization).toBe("Bearer github-token");
  expect(JSON.parse(init?.body as string)).toEqual({ ref: LEAD_REF });
  expect(LEAD_REF).toBe("main");
});

test("a refusal from GitHub fails the wake-up, saying what GitHub said, so it shows in the logs", async () => {
  vi.stubEnv(LEAD_WAKE_TOKEN_SETTING, "expired-token");
  github(401, "Bad credentials");
  await expect(freshConvex().action(internal.heartbeats.leadWake.wake, {})).rejects.toThrow(/GitHub refused to run the lead \(401\): Bad credentials/);
});
