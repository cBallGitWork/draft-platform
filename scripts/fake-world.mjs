// The fake outside world for an e2e run (#2288, spec/20, S20.17): the one server a throwaway Convex
// server's OUTSIDE_WORLD_URL points at (convex/outbound/outsideWorld.ts), so the run reaches no real
// feed and sends no real email. Each ask arrives as `/<real host>/<path>`:
// - FPL's and the Premier League's reads answer with gameweek 6's recording
//   (tests/support/recorded/gw6.payloads.ts says what it holds), its times moved so gameweek 6's
//   deadline falls when the run asks (`deadlineAt`, the run's start unless given). Only the times
//   the server reads move: deadlines, kickoffs and news dates. Words such as "Sat 10 Oct 2026, 12:30
//   BST" stay as recorded.
// - Resend's send is caught, not sent: `GET /_fake/emails` lists every one caught, newest last, in
//   the shape scripts/sign-in-inbox.mjs's `newestMatch` reads, so a test opens its sign-in link.
// - Anything else, Sportmonks and Anthropic among them, answers 404 naming the address, and is kept:
//   `GET /_fake/misses` lists them, so a run can fail on a read nobody recorded rather than pass
//   on an empty answer.
//
// Usage: node scripts/fake-world.mjs [port]   prints its address, and runs until stopped.

import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { SECOND_MS } from "../convex/shared/time.ts";
import { CHECKOUT, ranDirectly } from "./thisScript.mjs";

const RECORDED = join(CHECKOUT, "tests", "support", "recorded");
const readRecorded = (file) => JSON.parse(readFileSync(join(RECORDED, file), "utf8"));

/** The one gameweek recorded whole from both feeds. */
export const RECORDED_GAMEWEEK = 6;

/** Where the fake's own lists are read, clear of any real host. */
export const FAKE_PATH = "/_fake";

const FPL_HOST = "fantasy.premierleague.com";
const PL_HOST = "footballapi.pulselive.com";
const RESEND_HOST = "api.resend.com";

/** Gameweek 6's recording, read once. */
function recording() {
  return {
    bootstrap: readRecorded("fpl-gw6-bootstrap.json"),
    fplFixtures: readRecorded("fpl-gw6-fixtures.json"),
    live: readRecorded("fpl-gw6-live.json"),
    round: readRecorded("pl-gw6-round.json"),
    plFixtures: readRecorded("pl-gw6-fixtures.json"),
    playerStats: readRecorded("pl-gw6-player-stats.json"),
  };
}

/** Gameweek 6's deadline as recorded, in ms: the moment `deadlineAt` moves. */
function recordedDeadline(bootstrap) {
  const event = bootstrap.events.find((each) => each.id === RECORDED_GAMEWEEK);
  return Date.parse(event.deadline_time);
}

// The times the server reads, by key: ISO strings, whole seconds, and the Premier League's
// `{ millis }` under a kickoff. A `millis` elsewhere, such as a player's birth date, stays.
const ISO_KEYS = new Set(["deadline_time", "kickoff_time", "news_added"]);
const SECONDS_KEYS = new Set(["deadline_time_epoch"]);
const MILLIS_PARENTS = new Set(["kickoff", "provisionalKickoff"]);

const movedIso = (value, byMs) => new Date(Date.parse(value) + byMs).toISOString().replace(".000Z", "Z");

/** A copy of `payload` with every time the server reads moved by `byMs`; an empty time stays empty. */
export function shiftTimes(payload, byMs, parentKey = null) {
  if (Array.isArray(payload)) return payload.map((each) => shiftTimes(each, byMs, parentKey));
  if (payload === null || typeof payload !== "object") return payload;
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      if (ISO_KEYS.has(key) && typeof value === "string") return [key, movedIso(value, byMs)];
      if (SECONDS_KEYS.has(key) && typeof value === "number") return [key, value + Math.round(byMs / SECOND_MS)];
      if (key === "millis" && MILLIS_PARENTS.has(parentKey) && typeof value === "number") return [key, value + byMs];
      return [key, shiftTimes(value, byMs, key)];
    }),
  );
}

/** The recorded answer to a GET of `https://<host><pathAndQuery>`, its times unmoved, or null when
 *  none was recorded. */
function recordedAnswer(recorded, host, pathAndQuery) {
  const url = new URL(pathAndQuery, `https://${host}`);
  const path = url.pathname;
  if (host === FPL_HOST) {
    if (path === "/api/bootstrap-static/") return recorded.bootstrap;
    if (path === "/api/fixtures/") return recorded.fplFixtures;
    if (path === `/api/event/${RECORDED_GAMEWEEK}/live/`) return recorded.live;
    return null;
  }
  if (host === PL_HOST) {
    if (path === "/football/fixtures") {
      return url.searchParams.get("gameweekNumbers") === String(RECORDED_GAMEWEEK) ? recorded.round : null;
    }
    const fixture = path.match(/^\/football\/fixtures\/(\d+)$/);
    if (fixture) return recorded.plFixtures.find((each) => each.id === Number(fixture[1])) ?? null;
    const player = path.match(/^\/football\/stats\/player\/(\d+)$/);
    if (player) {
      const read = recorded.playerStats.find(
        (each) => each.player === Number(player[1]) && each.fixture === Number(url.searchParams.get("fixtures")),
      );
      return read?.payload ?? null;
    }
  }
  return null;
}

/** One caught email as `newestMatch` reads it: `to` a list, `created_at` when it was caught. */
function caughtEmail(body, caughtAt) {
  const to = Array.isArray(body.to) ? body.to : [body.to];
  return { to, from: body.from, subject: body.subject, text: body.text, created_at: new Date(caughtAt).toISOString() };
}

const json = (response, status, body) => {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
};

async function bodyOf(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Starts the fake on `port` (0 picks a free one). `deadlineAt` (ms) is when gameweek 6's deadline
 * falls, the run's start unless given; `now` is the tests'. Resolves to its address, the emails
 * caught and the addresses missed so far, and `close`.
 */
export async function startFakeWorld({ port = 0, deadlineAt, now = Date.now } = {}) {
  const recorded = recording();
  const byMs = (deadlineAt ?? now()) - recordedDeadline(recorded.bootstrap);
  const emails = [];
  const misses = [];

  const server = createServer(async (request, response) => {
    const address = new URL(request.url, "http://fake");
    if (address.pathname === `${FAKE_PATH}/emails`) return json(response, 200, emails);
    if (address.pathname === `${FAKE_PATH}/misses`) return json(response, 200, misses);
    const [, host, ...rest] = address.pathname.split("/");
    const pathAndQuery = `/${rest.join("/")}${address.search}`;
    if (request.method === "POST" && host === RESEND_HOST && pathAndQuery === "/emails") {
      emails.push(caughtEmail(JSON.parse(await bodyOf(request)), now()));
      return json(response, 200, { id: `fake-email-${emails.length}` });
    }
    const answer = request.method === "GET" ? recordedAnswer(recorded, host, pathAndQuery) : null;
    if (answer !== null) return json(response, 200, shiftTimes(answer, byMs));
    const miss = `${request.method} https://${host}${pathAndQuery}`;
    misses.push(miss);
    return json(response, 404, { error: `the fake outside world has no recording of ${miss}` });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    emails: () => structuredClone(emails),
    misses: () => [...misses],
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

if (ranDirectly(import.meta.url)) {
  const port = process.argv[2] === undefined ? 0 : Number(process.argv[2]);
  const fake = await startFakeWorld({ port });
  console.log(fake.url);
}
