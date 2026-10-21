import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { plCommentaryUrl, plFixtureUrl, plTeamStatsUrl } from "../../convex/football/football.ts";
import {
  COMMENTARY_MATCH,
  recordedCommentary,
  recordedSheets,
  recordedTeamStats,
  UPCOMING_MATCH,
} from "../support/recorded/commentary.payloads.ts";
import { fixtureStatus, phase, poll, pollReads, record, summaryLine } from "../../scripts/record-match.mjs";

const BRENTFORD_LIVERPOOL = COMMENTARY_MATCH.brentfordLiverpool;
const IPSWICH_FOREST = UPCOMING_MATCH;
const KICKOFF = Date.UTC(2026, 9, 23, 19);
// Pinned here, not imported, so a change to the recorder's timings fails a test.
const MINUTE = 60_000;
const POLL = 30_000;
const PAUSE = 1_000;
const LEAD = 90 * MINUTE;
const AFTER_FULL_TIME = 15 * MINUTE;
const GIVE_UP = 4 * 60 * MINUTE;

test("a poll reads the commentary, the fixture and the team stats, in that order, on the seam's URLs", () => {
  expect(pollReads(IPSWICH_FOREST).map((read) => read.url)).toEqual([
    plCommentaryUrl(IPSWICH_FOREST),
    plFixtureUrl(IPSWICH_FOREST),
    plTeamStatsUrl(IPSWICH_FOREST),
  ]);
});

const FULL_TIME_SEEN = KICKOFF + 115 * MINUTE;

test.each([
  ["a minute short of 90 minutes before kickoff", "wait", KICKOFF - LEAD - MINUTE, null],
  ["90 minutes before kickoff", "record", KICKOFF - LEAD, null],
  ["during the match", "record", KICKOFF + 45 * MINUTE, null],
  ["full time, just seen", "record", FULL_TIME_SEEN, FULL_TIME_SEEN],
  ["a minute short of the quarter hour after full time", "record", FULL_TIME_SEEN + AFTER_FULL_TIME - MINUTE, FULL_TIME_SEEN],
  ["the quarter hour after full time", "stop", FULL_TIME_SEEN + AFTER_FULL_TIME, FULL_TIME_SEEN],
  ["a minute short of four hours on, with no full time seen", "record", KICKOFF + GIVE_UP - MINUTE, null],
  ["four hours on, with no full time seen", "stop", KICKOFF + GIVE_UP, null],
])("%s is %s", (_when, expected, now, fullTimeSeenAt) => {
  expect(phase(now, KICKOFF, fullTimeSeenAt)).toBe(expected);
});

test("a refused read is saved with why, and the poll goes on to the next", async () => {
  const fixture = { id: IPSWICH_FOREST, status: "U", teamLists: [null, null] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => {
      if (url === plCommentaryUrl(IPSWICH_FOREST)) return new Response("Forbidden", { status: 403 });
      return Response.json(url === plFixtureUrl(IPSWICH_FOREST) ? fixture : { entity: { id: IPSWICH_FOREST } });
    }),
  );

  const saved = await poll(IPSWICH_FOREST, 0);

  expect(saved.reads.map((read) => read.kind)).toEqual(["commentary", "fixture", "teamStats"]);
  expect(saved.reads[0].error).toBe(`${plCommentaryUrl(IPSWICH_FOREST)} answered 403`);
  expect(saved.reads[1].body).toEqual(fixture);
  expect(fixtureStatus(saved)).toBe("U");
  expect(summaryLine(saved)).toContain(`commentary FAILED: ${plCommentaryUrl(IPSWICH_FOREST)} answered 403`);
});

test("a finished match's poll sums up as its newest line, its sheets and the five team stats, home first", () => {
  const fixture = { ...recordedSheets(BRENTFORD_LIVERPOOL), status: "C", clock: { label: "90+7'00" }, teams: [{ team: { id: 130 } }, { team: { id: 10 } }] };
  const saved = {
    polledAt: "2026-10-17T15:58:30.000Z",
    reads: [
      { kind: "commentary", body: recordedCommentary(BRENTFORD_LIVERPOOL) },
      { kind: "fixture", body: fixture },
      { kind: "teamStats", body: recordedTeamStats(BRENTFORD_LIVERPOOL) },
    ],
  };

  expect(summaryLine(saved)).toBe(
    "15:58:30 UTC  |  commentary: 122, newest 01' end 14 (2867014)  |  status C, clock 90+7'00, named 20+20  |  " +
      "shots 10-21, on target 2-5, possession 40-60, corners 3-9, yellows 2-3, reds 2-0",
  );
});

test("a body it cannot sum up is said, and the rest of the poll still is", () => {
  const saved = {
    polledAt: "2026-10-23T19:00:00.000Z",
    reads: [
      { kind: "commentary", body: { content: [] } },
      { kind: "fixture", body: { status: "U", teamLists: [null, null] } },
    ],
  };

  expect(summaryLine(saved)).toMatch(/^19:00:00 UTC {2}\| {2}commentary UNREADABLE: .+ {2}\| {2}status U, clock -, named 0\+0$/);
});

test("before kickoff, a poll sums up as no commentary, no one named and no team stats", () => {
  const saved = {
    polledAt: "2026-10-20T12:00:00.000Z",
    reads: [
      { kind: "commentary", body: recordedCommentary(IPSWICH_FOREST) },
      { kind: "fixture", body: { status: "U", teamLists: [null, null] } },
      { kind: "teamStats", body: recordedTeamStats(IPSWICH_FOREST) },
    ],
  };

  expect(summaryLine(saved)).toBe("12:00:00 UTC  |  commentary: none  |  status U, clock -, named 0+0  |  team stats: none");
});

test("a fixture read with no team sheets at all sums up as no one named", () => {
  const saved = { polledAt: "2026-10-20T12:00:00.000Z", reads: [{ kind: "fixture", body: { status: "U" } }] };
  expect(summaryLine(saved)).toBe("12:00:00 UTC  |  status U, clock -, named -");
});

/** Runs the recorder from `startAt` against a fake feed whose fixture status is `statusAt(now)`;
 *  gives the time of each read of each kind and the number of polls saved. */
async function recordAgainst(startAt, statusAt) {
  vi.useFakeTimers({ now: startAt });
  vi.spyOn(console, "log").mockImplementation(() => {});
  const asked = { commentary: [], fixture: [], teamStats: [] };
  const answer = (body) => ({ ok: true, status: 200, json: async () => body });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => {
      if (url === plCommentaryUrl(IPSWICH_FOREST)) {
        asked.commentary.push(Date.now());
        return answer({ events: { content: [] } });
      }
      if (url === plTeamStatsUrl(IPSWICH_FOREST)) {
        asked.teamStats.push(Date.now());
        return answer({ entity: { id: IPSWICH_FOREST } });
      }
      if (url !== plFixtureUrl(IPSWICH_FOREST)) throw new Error(`no fake for ${url}`);
      asked.fixture.push(Date.now());
      return answer({ id: IPSWICH_FOREST, kickoff: { millis: KICKOFF }, status: statusAt(Date.now()) });
    }),
  );
  const dir = mkdtempSync(join(tmpdir(), "record-match-"));
  try {
    let done = false;
    const recording = record(IPSWICH_FOREST, dir).finally(() => (done = true));
    while (!done) await vi.advanceTimersByTimeAsync(MINUTE);
    await recording;
    return { asked, polls: readdirSync(dir).length };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const gapsOf = (times) => times.slice(1).map((time, index) => time - times[index]);
// Each plays hours of polls through fake timers: about 2s alone on a Mac, but past vitest's 5s
// default on a loaded machine (seen 20 Oct 2026), and CI's runner is smaller.
const HOURS_OF_POLLS = { timeout: 30_000 };

test("the recorder waits until 90 minutes before kickoff, polls every 30 seconds, and stops a quarter hour after full time", HOURS_OF_POLLS, async () => {
  const fullTimeAt = KICKOFF + 112 * MINUTE;
  const statusAt = (now) => (now < KICKOFF ? "U" : now < fullTimeAt ? "L" : "C");

  const { asked, polls } = await recordAgainst(KICKOFF - LEAD - 5.5 * MINUTE, statusAt);

  const [firstPoll] = asked.commentary;
  const lastPoll = asked.commentary.at(-1);
  expect(firstPoll).toBe(KICKOFF - LEAD);
  expect(new Set(gapsOf(asked.commentary))).toEqual(new Set([POLL]));
  // The first fixture read is for the kickoff time; each poll's comes a second after its commentary.
  expect(asked.fixture.slice(1).map((time, index) => time - asked.commentary[index])).toEqual(asked.commentary.map(() => PAUSE));
  expect(asked.teamStats.map((time, index) => time - asked.commentary[index])).toEqual(asked.commentary.map(() => 2 * PAUSE));
  // Full time is seen at the first poll on or after it; the last poll is the one a quarter hour on.
  expect(lastPoll).toBe(fullTimeAt + AFTER_FULL_TIME);
  expect(polls).toBe(asked.commentary.length);
});

test("a match that never reaches full time stops being recorded four hours after kickoff", HOURS_OF_POLLS, async () => {
  const { asked } = await recordAgainst(KICKOFF - LEAD, () => "L");

  expect(asked.commentary.at(-1)).toBe(KICKOFF + GIVE_UP - POLL);
});
