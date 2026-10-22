// The recorder's summary: the one line each saved poll sums up as, and `--summary` over a folder of
// them. Running the recorder itself is tested in record-match.test.mjs.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import {
  COMMENTARY_MATCH,
  recordedCommentary,
  recordedSheets,
  recordedTeamStats,
  UPCOMING_MATCH,
} from "../support/recorded/commentary.payloads.ts";
import { summarise, summaryLine } from "../../scripts/record-match.mjs";

const BRENTFORD_LIVERPOOL = COMMENTARY_MATCH.brentfordLiverpool;
const IPSWICH_FOREST = UPCOMING_MATCH;
const POLLED_AT_KICKOFF = new Date(Date.UTC(2026, 9, 23, 19)).toISOString();

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

test("a fixture read with no status says so, and still sums up its clock and sheets", () => {
  const saved = {
    polledAt: POLLED_AT_KICKOFF,
    reads: [{ kind: "fixture", body: { clock: { label: "12'00" }, teamLists: [null, null] } }],
  };
  expect(summaryLine(saved)).toBe("19:00:00 UTC  |  status UNREADABLE (undefined), clock 12'00, named 0+0");
});

test("a failed read saved with no cause, as older polls were, still sums up", () => {
  const saved = { polledAt: POLLED_AT_KICKOFF, reads: [{ kind: "commentary", error: "fetch failed" }] };
  expect(summaryLine(saved)).toBe("19:00:00 UTC  |  commentary FAILED: fetch failed");
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
