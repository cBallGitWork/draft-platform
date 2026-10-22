import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { plCommentaryUrl, plFixtureUrl, plTeamStatsUrl } from "../../convex/football/football.ts";
import { PL_FULL_TIME } from "../../convex/football/premierLeague.ts";
import { LIVE_WINDOW_MS } from "../../convex/stats/liveStats.ts";
import {
  COMMENTARY_MATCH,
  recordedCommentary,
  recordedSheets,
  recordedTeamStats,
  UPCOMING_MATCH,
} from "../support/recorded/commentary.payloads.ts";
import { doneLine, fixtureStatus, phase, poll, pollReads, record, summarise, summaryLine } from "../../scripts/record-match.mjs";

const BRENTFORD_LIVERPOOL = COMMENTARY_MATCH.brentfordLiverpool;
const IPSWICH_FOREST = UPCOMING_MATCH;
const KICKOFF = Date.UTC(2026, 9, 23, 19);
const POLLED_AT_KICKOFF = new Date(KICKOFF).toISOString();
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

// The recorder keeps its own copy of the live poller's window, as plain node can't import the server's.
test("with no full time seen, the recorder gives up where the live poller's window ends", () => {
  expect(phase(KICKOFF + LIVE_WINDOW_MS - MINUTE, KICKOFF, null)).toBe("record");
  expect(phase(KICKOFF + LIVE_WINDOW_MS, KICKOFF, null)).toBe("stop");
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
    polledAt: POLLED_AT_KICKOFF,
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
 *  gives the time of each read of each kind, the number of polls saved and the lines it logged. */
async function recordAgainst(startAt, statusAt) {
  vi.useFakeTimers({ now: startAt });
  const logged = [];
  vi.spyOn(console, "log").mockImplementation((line) => logged.push(line));
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
    return { asked, polls: readdirSync(dir).length, logged };
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
  const statusAt = (now) => (now < KICKOFF ? "U" : now < fullTimeAt ? "L" : PL_FULL_TIME);

  const { asked, polls, logged } = await recordAgainst(KICKOFF - LEAD - 5.5 * MINUTE, statusAt);

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
  // Seeing full time is said once, and the last line says that is why it stopped.
  expect(logged.filter((line) => line.startsWith("Full time seen at "))).toHaveLength(1);
  expect(logged.at(-1)).toMatch(/; stopped 15 min after full time \(seen .+\)$/);
});

test("a match that never reaches full time stops being recorded four hours after kickoff", HOURS_OF_POLLS, async () => {
  const { asked, logged } = await recordAgainst(KICKOFF - LEAD, () => "L");

  expect(asked.commentary.at(-1)).toBe(KICKOFF + GIVE_UP - POLL);
  expect(logged.at(-1)).toMatch(/; GAVE UP 4h after kickoff, full time never seen$/);
});

// Friday's recorder runs under plain node, not vitest: this proves it, and the files it imports
// (convex/football/football.ts, convex/shared/time.ts), still load there.
test("under plain node, the recorder loads and, given no fixture id, prints its usage and exits 2", async () => {
  const script = join(import.meta.dirname, "../../scripts/record-match.mjs");
  const { code, output } = await new Promise((resolve) => {
    const child = spawn(process.execPath, [script], { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("close", (code) => resolve({ code, output }));
  });
  expect(output).toContain("Usage: node scripts/record-match.mjs <fixtureId> [--summary]");
  expect(code).toBe(2);
});

const RECORDING_DIR = "/r/128999";

test("the last line says the recording stopped after full time, and when full time was seen", () => {
  const seen = KICKOFF + 112 * MINUTE;
  expect(doneLine(250, RECORDING_DIR, seen)).toBe(
    `Done: 250 polls in /r/128999/; stopped 15 min after full time (seen ${new Date(seen).toLocaleTimeString("en-GB")})`,
  );
});

test("the last line says the recording gave up when full time was never seen", () => {
  expect(doneLine(660, RECORDING_DIR, null)).toBe("Done: 660 polls in /r/128999/; GAVE UP 4h after kickoff, full time never seen");
});

test("a fixture read with no status says so, and still sums up its clock and sheets", () => {
  const saved = {
    polledAt: POLLED_AT_KICKOFF,
    reads: [{ kind: "fixture", body: { clock: { label: "12'00" }, teamLists: [null, null] } }],
  };
  expect(summaryLine(saved)).toBe("19:00:00 UTC  |  status UNREADABLE (undefined), clock 12'00, named 0+0");
});

/** What Node's fetch throws when the network fails: a bare "fetch failed", the reason on `cause`. */
const networkFailure = (code) => new TypeError("fetch failed", { cause: Object.assign(new Error(`connect ${code}`), { code }) });

test("a read that failed underneath is saved with its cause, and sums up with it", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => {
      if (url === plCommentaryUrl(IPSWICH_FOREST)) throw networkFailure("ENOTFOUND");
      return Response.json({ status: "U" });
    }),
  );

  const saved = await poll(IPSWICH_FOREST, 0);

  expect(saved.reads[0]).toMatchObject({ error: "fetch failed", cause: "ENOTFOUND" });
  expect(saved.reads[1]).not.toHaveProperty("cause");
  expect(summaryLine(saved)).toContain("commentary FAILED: fetch failed (ENOTFOUND)  |  status U");
});

test("a failed read saved with no cause, as older polls were, still sums up", () => {
  const saved = { polledAt: POLLED_AT_KICKOFF, reads: [{ kind: "commentary", error: "fetch failed" }] };
  expect(summaryLine(saved)).toBe("19:00:00 UTC  |  commentary FAILED: fetch failed");
});

test("when the start-up kickoff read fails, the recorder stops at once, naming the URL and the cause", async () => {
  const fetch = vi.fn(async () => {
    throw networkFailure("ECONNRESET");
  });
  vi.stubGlobal("fetch", fetch);

  await expect(record(IPSWICH_FOREST, join(tmpdir(), "record-match-never-made"))).rejects.toThrow(
    `${plFixtureUrl(IPSWICH_FOREST)}: fetch failed (ECONNRESET)`,
  );
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("a summary names a cut-off poll file and goes on to the next", () => {
  const dir = mkdtempSync(join(tmpdir(), "record-match-summary-"));
  const lines = [];
  vi.spyOn(console, "log").mockImplementation((line) => lines.push(line));
  const fixturePoll = (polledAt) => JSON.stringify({ polledAt, reads: [{ kind: "fixture", body: { status: "U" } }] });
  try {
    writeFileSync(join(dir, "2026-10-23T19-00-00.000Z.json"), fixturePoll(POLLED_AT_KICKOFF));
    writeFileSync(join(dir, "2026-10-23T19-00-30.000Z.json"), fixturePoll("2026-10-23T19:00:30.000Z").slice(0, 20));
    writeFileSync(join(dir, "2026-10-23T19-01-00.000Z.json"), fixturePoll("2026-10-23T19:01:00.000Z"));

    summarise(dir);

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("19:00:00 UTC  |  status U, clock -, named -");
    expect(lines[1]).toMatch(/^2026-10-23T19-00-30\.000Z\.json UNREADABLE: .+/);
    expect(lines[2]).toBe("19:01:00 UTC  |  status U, clock -, named -");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
