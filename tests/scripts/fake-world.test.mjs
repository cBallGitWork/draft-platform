// scripts/fake-world.mjs, the fake outside world an e2e run's throwaway server reaches (spec/20,
// S20.17; #2288), asked as the server asks it: through outsideUrl, with OUTSIDE_WORLD_URL set.

import { afterEach, expect, test, vi } from "vitest";
import { FPL_BOOTSTRAP_URL, FPL_FIXTURES_URL, fplLiveUrl, plFixturesUrl, plFixtureUrl, plPlayerStatsUrl } from "../../convex/football/football.ts";
import { OUTSIDE_WORLD_SETTING } from "../../convex/outbound/deploymentSettings.ts";
import { RESEND_API_URL } from "../../convex/outbound/resend.ts";
import { outsideUrl } from "../../convex/outbound/outsideWorld.ts";
import { HOUR_MS } from "../../convex/shared/time.ts";
import { FAKE_PATH, RECORDED_GAMEWEEK, shiftTimes, startFakeWorld } from "../../scripts/fake-world.mjs";
import { linkIn, newestMatch } from "../../scripts/sign-in-inbox.mjs";

// From tests/support/recorded/gw6.payloads.ts: gameweek 6's deadline and first kickoff as recorded,
// Hull v Everton's Premier League id, and Hull's striker.
const RECORDED_DEADLINE = Date.parse("2026-10-10T10:00:00Z");
const RECORDED_FIRST_KICKOFF = Date.parse("2026-10-10T11:30:00Z");
const HULL_EVERTON = 128978;
const MCBURNIE = 8107;
const PL_THIS_SEASON = 841;

const RUN_START = Date.parse("2026-11-16T09:00:00Z");
const SITE = "http://127.0.0.1:5999";

let fake;
afterEach(async () => {
  await fake?.close();
  fake = undefined;
});

async function started(options = {}) {
  fake = await startFakeWorld({ now: () => RUN_START, ...options });
  vi.stubEnv(OUTSIDE_WORLD_SETTING, fake.url);
  return fake;
}

const read = async (url) => {
  const response = await fetch(outsideUrl(url));
  return { status: response.status, body: await response.json() };
};

test("S20.17: FPL's reads answer with gameweek 6's recording, its deadline moved to the run's start", async () => {
  await started();
  const { status, body } = await read(FPL_BOOTSTRAP_URL);
  expect(status).toBe(200);
  const gameweek = body.events.find((event) => event.id === RECORDED_GAMEWEEK);
  expect(Date.parse(gameweek.deadline_time)).toBe(RUN_START);
  expect(gameweek.deadline_time_epoch * 1000).toBe(RUN_START);
  expect(body.elements.length).toBeGreaterThan(0);

  const fixtures = await read(FPL_FIXTURES_URL);
  const firstKickoff = Math.min(...fixtures.body.map((fixture) => Date.parse(fixture.kickoff_time)));
  expect(firstKickoff).toBe(RUN_START + (RECORDED_FIRST_KICKOFF - RECORDED_DEADLINE));
  expect((await read(fplLiveUrl(RECORDED_GAMEWEEK))).body.elements.length).toBeGreaterThan(0);
});

test("S20.17: the deadline falls when the run asks, with every kickoff the same time after it", async () => {
  const deadlineAt = RUN_START + 2 * HOUR_MS;
  await started({ deadlineAt });
  const { body } = await read(plFixtureUrl(HULL_EVERTON));
  expect(body.id).toBe(HULL_EVERTON);
  const recorded = (await import("../support/recorded/pl-gw6-fixtures.json", { with: { type: "json" } })).default.find(
    (fixture) => fixture.id === HULL_EVERTON,
  );
  expect(body.kickoff.millis - recorded.kickoff.millis).toBe(deadlineAt - RECORDED_DEADLINE);
  expect(body.kickoff.label).toBe(recorded.kickoff.label);
});

test("S20.17: the Premier League's round and a man's match stats replay; a birth date stays as recorded", async () => {
  await started();
  const round = await read(plFixturesUrl(PL_THIS_SEASON, RECORDED_GAMEWEEK));
  expect(round.status).toBe(200);
  expect(round.body.content.some((fixture) => fixture.id === HULL_EVERTON)).toBe(true);

  const stats = await read(plPlayerStatsUrl(MCBURNIE, HULL_EVERTON));
  expect(stats.status).toBe(200);
  const recorded = (await import("../support/recorded/pl-gw6-player-stats.json", { with: { type: "json" } })).default.find(
    (each) => each.player === MCBURNIE && each.fixture === HULL_EVERTON,
  );
  expect(stats.body).toEqual(shiftTimes(recorded.payload, RUN_START - RECORDED_DEADLINE));
  expect(JSON.stringify(stats.body)).toBe(JSON.stringify(recorded.payload));
});

test("S20.17: an address with no recording answers 404 naming it, and is listed as missed", async () => {
  await started();
  const missed = await read(fplLiveUrl(RECORDED_GAMEWEEK + 1));
  expect(missed.status).toBe(404);
  expect(missed.body.error).toContain(`fantasy.premierleague.com/api/event/${RECORDED_GAMEWEEK + 1}/live/`);
  const anthropic = await fetch(outsideUrl("https://api.anthropic.com/v1/messages"), { method: "POST", body: "{}" });
  expect(anthropic.status).toBe(404);
  expect(fake.misses()).toEqual([
    `GET https://fantasy.premierleague.com/api/event/${RECORDED_GAMEWEEK + 1}/live/`,
    "POST https://api.anthropic.com/v1/messages",
  ]);
  expect(await (await fetch(`${fake.url}${FAKE_PATH}/misses`)).json()).toEqual(fake.misses());
});

test("S20.17: an email sent through Resend is caught, not sent, and its sign-in link read back", async () => {
  await started();
  const to = "manager1@e2e.test";
  const sent = await fetch(outsideUrl(`${RESEND_API_URL}/emails`), {
    method: "POST",
    headers: { Authorization: "Bearer re_fake", "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Draft <signin@e2e.test>", to, subject: "Your link to sign in, 16 Nov", text: `Sign in: ${SITE}/?code=123` }),
  });
  expect(sent.status).toBe(200);
  expect((await sent.json()).id).toBeTruthy();

  const emails = await (await fetch(`${fake.url}${FAKE_PATH}/emails`)).json();
  expect(emails).toEqual(fake.emails());
  const email = newestMatch(emails, { to, subject: "Your link to sign in", since: RUN_START });
  expect(linkIn(email.text, SITE)).toBe(`${SITE}/?code=123`);
  expect(fake.misses()).toEqual([]);
});

test("S20.17: a send to Resend with a malformed body answers 400 and is listed as missed, and the fake keeps running", async () => {
  await started();
  const send = (body) => fetch(outsideUrl(`${RESEND_API_URL}/emails`), { method: "POST", body });
  const notJson = await send("{not json");
  expect(notJson.status).toBe(400);
  expect((await notJson.json()).error).toContain("POST https://api.resend.com/emails");
  expect((await send("null")).status).toBe(400);
  expect(fake.emails()).toEqual([]);
  const malformed = "POST https://api.resend.com/emails, its body not a JSON object";
  expect(fake.misses()).toEqual([malformed, malformed]);
  expect((await read(FPL_BOOTSTRAP_URL)).status).toBe(200);
});
