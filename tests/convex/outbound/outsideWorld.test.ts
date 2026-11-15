// Every outside service as one setting (#2288): where OUTSIDE_WORLD_URL is set, as only on an e2e
// run's throwaway server (spec/20, S20.17), each read and send goes to that one fake server instead,
// and unset, as on live and development, it goes where it says.
import { afterEach, expect, test, vi } from "vitest";
import { ANTHROPIC_MESSAGES_URL, writeWithClaude } from "../../../convex/outbound/claude";
import { ANTHROPIC_KEY_SETTING, OUTSIDE_WORLD_SETTING, RESEND_KEY_SETTING } from "../../../convex/outbound/deploymentSettings";
import { RESEND_EMAILS_URL, sendEmail } from "../../../convex/outbound/email";
import { outsideUrl } from "../../../convex/outbound/outsideWorld";
import { FPL_BOOTSTRAP_URL, getJson, plCompSeasonsUrl } from "../../../convex/football/football";
import { getData, leagueUrl } from "../../../convex/football/sportmonks/sportmonks";
import { fakeFetch } from "../../support/convex/test.harness";

const FAKE_WORLD = "http://127.0.0.1:3999";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("S20.17: unset, as on live and development, every address is the real one", () => {
  vi.stubEnv(OUTSIDE_WORLD_SETTING, "");
  expect(outsideUrl(FPL_BOOTSTRAP_URL)).toBe(FPL_BOOTSTRAP_URL);
});

test("S20.17: set, an address goes to the fake server with the real host first in its path, its query kept", () => {
  vi.stubEnv(OUTSIDE_WORLD_SETTING, `${FAKE_WORLD}/`);
  expect(outsideUrl(RESEND_EMAILS_URL)).toBe(`${FAKE_WORLD}/api.resend.com/emails`);
  expect(outsideUrl(plCompSeasonsUrl())).toBe(`${FAKE_WORLD}/footballapi.pulselive.com/football/competitions/1/compseasons?pageSize=100`);
});

test("S20.17: set, FPL and the Premier League, Sportmonks, Resend and Anthropic are each asked at the fake server", async () => {
  vi.stubEnv(OUTSIDE_WORLD_SETTING, FAKE_WORLD);
  vi.stubEnv(RESEND_KEY_SETTING, "re-test");
  vi.stubEnv(ANTHROPIC_KEY_SETTING, "sk-test");
  const sportmonks = leagueUrl(501);
  const faked = [FPL_BOOTSTRAP_URL, sportmonks, RESEND_EMAILS_URL, ANTHROPIC_MESSAGES_URL].map(outsideUrl);
  expect(faked.every((url) => url.startsWith(`${FAKE_WORLD}/`))).toBe(true);
  // One body every service's reader takes: Sportmonks' `data`, Claude's `content`.
  const fetchMock = fakeFetch(new Map(faked.map((url) => [url, { data: {}, content: [{ type: "text", text: "Fine." }] }])));
  vi.stubGlobal("fetch", fetchMock);
  await getJson(FPL_BOOTSTRAP_URL);
  await getData(sportmonks, "token");
  await sendEmail("manager@example.com", { subject: "Hello", text: "Hello." });
  await writeWithClaude({ system: "Be a scout.", prompt: "Player: Scorer.", maxTokens: 400 });
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(faked);
});
