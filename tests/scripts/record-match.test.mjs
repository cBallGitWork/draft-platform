// Running the recorder: when it polls, what each poll saves, when it stops and what it says.
// What one read saves, and how the recorder starts, are tested in record-match-reads.test.mjs;
// how a saved poll sums up, in record-match-summary.test.mjs.
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { plCommentaryUrl, plFixtureUrl, plTeamStatsUrl } from "../../convex/football/football.ts";
import { PL_FULL_TIME } from "../../convex/football/premierLeague/premierLeague.ts";
import { LIVE_WINDOW_MS } from "../../convex/stats/liveStats.ts";
import { doneLine, phase, pollReads, record } from "../../scripts/record-match.mjs";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";
import { IPSWICH_FOREST, KICKOFF } from "../support/scripts/recordMatch.harness.mjs";

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

/** Runs the recorder from `startAt` against a fake feed whose fixture status is `statusAt(now)`,
 *  into a folder already holding `earlierPolls` polls; gives the time of each read of each kind,
 *  the number of polls in the folder at the end and the lines it logged. */
async function recordAgainst(startAt, statusAt, earlierPolls = 0) {
  vi.useFakeTimers({ now: startAt });
  const logged = [];
  vi.spyOn(console, "log").mockImplementation((line) => logged.push(line));
  const asked = { commentary: [], fixture: [], teamStats: [] };
  const answer = (body) => Response.json(body);
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
    for (let index = 0; index < earlierPolls; index += 1) writeFileSync(join(dir, `earlier-${index}.json`), "{}");
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

test("a rerun into the same folder says how many polls it already holds, and Done counts only this run's", async () => {
  const earlierPolls = 3;
  const { asked, polls, logged } = await recordAgainst(KICKOFF + 2 * 60 * MINUTE, () => PL_FULL_TIME, earlierPolls);

  expect(logged[0]).toMatch(new RegExp(`, which holds ${earlierPolls} polls already$`));
  expect(polls).toBe(asked.commentary.length + earlierPolls);
  expect(logged.at(-1)).toMatch(new RegExp(`^Done: ${asked.commentary.length} polls in `));
});

test("each poll's line after the first says how the commentary changed since the poll before", async () => {
  const { logged } = await recordAgainst(KICKOFF + 2 * 60 * MINUTE, () => PL_FULL_TIME);
  const pollLines = logged.filter((line) => line.includes("  |  commentary"));

  expect(pollLines.length).toBeGreaterThan(1);
  expect(pollLines[0]).toContain("|  commentary: none  |");
  expect(pollLines.slice(1).every((line) => line.includes("|  commentary: none, +0 -0 ~0  |"))).toBe(true);
});

// The recorder runs under plain node, not vitest: this proves it, and the files it imports
// (convex/football/football.ts, convex/shared/time.ts), still load there.
test("under plain node, the recorder loads and, given no fixture id, prints its usage and exits 2", async () => {
  const script = join(REPO_ROOT, "scripts/record-match.mjs");
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
  expect(doneLine(250, RECORDING_DIR, FULL_TIME_SEEN)).toBe(
    `Done: 250 polls in /r/128999/; stopped 15 min after full time (seen ${new Date(FULL_TIME_SEEN).toLocaleTimeString("en-GB")})`,
  );
});

test("the last line says the recording gave up when full time was never seen", () => {
  expect(doneLine(660, RECORDING_DIR, null)).toBe("Done: 660 polls in /r/128999/; GAVE UP 4h after kickoff, full time never seen");
});
