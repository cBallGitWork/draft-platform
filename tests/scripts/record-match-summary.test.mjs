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
import { recordedLiveCommentary } from "../support/recorded/live.payloads.ts";
import { summarise } from "../../scripts/record-match.mjs";
import { commentaryChanges, summaryLine } from "../../scripts/record-match-summary.mjs";

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

/** A commentary body holding `lines`, newest first, as the stream sends them. */
const commentaryOf = (...lines) => ({ events: { content: lines } });
const line = (id, text) => ({ id, type: "comment", text });

test("commentary changes count the lines added, gone and changed between two reads", () => {
  const before = commentaryOf(line(3, "Foul by Hutchinson."), line(2, "Corner."), line(1, "Kick off."));
  const after = commentaryOf(line(4, "Goal!"), line(2, "Corner, conceded by Morato."), line(1, "Kick off."));

  expect(commentaryChanges(before, after)).toBe("+1 -1 ~1");
  expect(commentaryChanges(after, after)).toBe("+0 -0 ~0");
});

test("a line counts as changed when any part of it differs, not only its text", () => {
  const before = commentaryOf({ ...line(1, "Goal!"), playerIds: [1] });
  const after = commentaryOf({ ...line(1, "Goal!"), playerIds: [1, 2] });
  expect(commentaryChanges(before, after)).toBe("+0 -0 ~1");
});

test("commentary changes are unknown when either read has no lines to compare", () => {
  expect(commentaryChanges(undefined, commentaryOf())).toBeNull();
  expect(commentaryChanges(commentaryOf(), { content: [] })).toBeNull();
});

// 49': 42 lines, two gone by full time; full time: 94, the first goal's reworded (live.payloads.ts).
test("from the 49th minute to full time on 23 Oct, 54 lines came, 2 went and the first goal's changed", () => {
  const added = 94 - (42 - 2);
  expect(commentaryChanges(recordedLiveCommentary("withVanished"), recordedLiveCommentary("final"))).toBe(`+${added} -2 ~1`);
});

test("given the commentary before it, a poll's line says how the commentary changed", () => {
  const saved = { polledAt: POLLED_AT_KICKOFF, reads: [{ kind: "commentary", body: commentaryOf(line(2, "Corner."), line(1, "Kick off.")) }] };
  expect(summaryLine(saved, commentaryOf(line(1, "Kick off.")))).toBe("19:00:00 UTC  |  commentary: 2, newest -' comment (2), +1 -0 ~0");
  expect(summaryLine(saved)).toBe("19:00:00 UTC  |  commentary: 2, newest -' comment (2)");
});

test("with no fixture read to say which side is home, the team stats say their order is unknown", () => {
  const saved = { polledAt: POLLED_AT_KICKOFF, reads: [{ kind: "teamStats", body: recordedTeamStats(BRENTFORD_LIVERPOOL) }] };
  // The feed's own order, Liverpool (10) first: the first test's numbers, sides swapped.
  expect(summaryLine(saved)).toBe(
    "19:00:00 UTC  |  order unknown: ids 10-130, shots 21-10, on target 5-2, possession 60-40, corners 9-3, yellows 3-2, reds 0-2",
  );
});

test("a side the team stats hold nothing for is named, not shown as noughts alone", () => {
  const teamStats = recordedTeamStats(BRENTFORD_LIVERPOOL);
  delete teamStats.data["10"];
  const fixture = { status: "L", teams: [{ team: { id: 130 } }, { team: { id: 10 } }] };
  const saved = { polledAt: POLLED_AT_KICKOFF, reads: [{ kind: "fixture", body: fixture }, { kind: "teamStats", body: teamStats }] };
  expect(summaryLine(saved)).toContain("|  no data for 10, shots 10-0, on target 2-0");
});

test("a summary says how the commentary changed from one poll to the next, past a poll whose read failed", () => {
  const dir = mkdtempSync(join(tmpdir(), "record-match-summary-"));
  const lines = [];
  vi.spyOn(console, "log").mockImplementation((logged) => lines.push(logged));
  const commentaryPoll = (polledAt, read) => JSON.stringify({ polledAt, reads: [{ kind: "commentary", ...read }] });
  try {
    writeFileSync(join(dir, "2026-10-23T19-00-00.000Z.json"), commentaryPoll(POLLED_AT_KICKOFF, { body: commentaryOf(line(1, "Kick off.")) }));
    writeFileSync(join(dir, "2026-10-23T19-00-30.000Z.json"), commentaryPoll("2026-10-23T19:00:30.000Z", { error: "fetch failed" }));
    writeFileSync(
      join(dir, "2026-10-23T19-01-00.000Z.json"),
      commentaryPoll("2026-10-23T19:01:00.000Z", { body: commentaryOf(line(2, "Corner."), line(1, "Kick-off.")) }),
    );

    summarise(dir);

    expect(lines).toEqual([
      "19:00:00 UTC  |  commentary: 1, newest -' comment (1)",
      "19:00:30 UTC  |  commentary FAILED: fetch failed",
      "19:01:00 UTC  |  commentary: 2, newest -' comment (2), +1 -0 ~1",
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
