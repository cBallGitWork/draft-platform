import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import { plCommentaryUrl, plFixtureUrl, plTeamStatsUrl } from "../convex/football.ts";
import {
  AFTER_FULL_TIME_MS,
  fixtureStatus,
  GIVE_UP_MS,
  LEAD_MS,
  phase,
  poll,
  pollReads,
  summaryLine,
} from "./record-match.mjs";

afterEach(() => vi.unstubAllGlobals());

const recorded = (name) => JSON.parse(readFileSync(new URL(`../convex/recorded/${name}`, import.meta.url), "utf8"));
const BRENTFORD_LIVERPOOL = 128984;
const IPSWICH_FOREST = 128999;
const KICKOFF = Date.UTC(2026, 9, 23, 19);

test("a poll reads the commentary, the fixture and the team stats, in that order, on the seam's URLs", () => {
  expect(pollReads(IPSWICH_FOREST).map((read) => read.url)).toEqual([
    plCommentaryUrl(IPSWICH_FOREST),
    plFixtureUrl(IPSWICH_FOREST),
    plTeamStatsUrl(IPSWICH_FOREST),
  ]);
});

test.each([
  ["a minute before the hour before kickoff", KICKOFF - LEAD_MS - 60_000, null, "wait"],
  ["the hour before kickoff", KICKOFF - LEAD_MS, null, "record"],
  ["during the match", KICKOFF + 45 * 60_000, null, "record"],
  ["full time, just seen", KICKOFF + 115 * 60_000, KICKOFF + 115 * 60_000, "record"],
  ["the quarter hour after full time", KICKOFF + 130 * 60_000, KICKOFF + 130 * 60_000 - AFTER_FULL_TIME_MS, "stop"],
  ["hours on, with no full time seen", KICKOFF + GIVE_UP_MS, null, "stop"],
])("%s is %s", (_when, now, fullTimeSeenAt, expected) => {
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
  const sheets = recorded("pl-commentary-sheets.json").find((each) => each.id === BRENTFORD_LIVERPOOL);
  const fixture = { ...sheets, status: "C", clock: { label: "90+7'00" }, teams: [{ team: { id: 130 } }, { team: { id: 10 } }] };
  const saved = {
    polledAt: "2026-10-17T15:58:30.000Z",
    reads: [
      { kind: "commentary", body: recorded("pl-commentary.json")[BRENTFORD_LIVERPOOL] },
      { kind: "fixture", body: fixture },
      { kind: "teamStats", body: recorded("pl-team-stats.json")[BRENTFORD_LIVERPOOL] },
    ],
  };

  expect(summaryLine(saved)).toBe(
    "15:58:30 UTC  |  commentary: 122, newest 01' end 14 (2867014)  |  status C, clock 90+7'00, named 20+20  |  " +
      "shots 10-21, on target 2-5, possession 40-60, corners 3-9, yellows 2-3, reds 2-0",
  );
});

test("before kickoff, a poll sums up as no commentary, no one named and no team stats", () => {
  const saved = {
    polledAt: "2026-10-20T12:00:00.000Z",
    reads: [
      { kind: "commentary", body: recorded("pl-commentary.json")[IPSWICH_FOREST] },
      { kind: "fixture", body: { status: "U", teamLists: [null, null] } },
      { kind: "teamStats", body: recorded("pl-team-stats.json")[IPSWICH_FOREST] },
    ],
  };

  expect(summaryLine(saved)).toBe("12:00:00 UTC  |  commentary: none  |  status U, clock -, named 0+0  |  team stats: none");
});
