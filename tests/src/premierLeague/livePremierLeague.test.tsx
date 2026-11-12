// The Premier League seam's live wiring, with Convex's queries faked by name: what it asks the
// server, and that it hands on what comes back as it comes.

import { renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { livePremierLeague } from "../../../src/premierLeague/livePremierLeague";
import { ARSENAL, CHELSEA, plMatch } from "../../support/src/premierLeague.harness";
import { A_LEAGUE_ID } from "../../support/src/convexReact.harness";

const NOW = Date.parse("2026-10-27T16:00:00Z");

const convex = vi.hoisted(() => ({ firstKickoffs: vi.fn(), ofGameweek: vi.fn(), ofSeason: vi.fn(), ofMatch: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: {
      "football/plGameweeks:firstKickoffs": convex.firstKickoffs,
      "football/matchScores:ofGameweek": convex.ofGameweek,
      "football/plStandings:ofSeason": convex.ofSeason,
      "match/matchPage:ofMatch": convex.ofMatch,
    },
  }),
);

test("it asks football/plGameweeks:firstKickoffs with nothing, and hands on what comes back", () => {
  const gameweeks = { seasonGameweeks: 34, firstKickoffs: [{ gameweek: 1, firstKickoff: 1_000 }] };
  convex.firstKickoffs.mockReturnValue(gameweeks);
  expect(renderHook(() => livePremierLeague.useGameweeks()).result.current).toBe(gameweeks);
  expect(convex.firstKickoffs).toHaveBeenCalledWith({});
});

test("it asks football/matchScores:ofGameweek with the gameweek, and hands on what comes back", () => {
  const matches = [plMatch(1, ARSENAL, CHELSEA, 1_000)];
  convex.ofGameweek.mockReturnValue(matches);
  expect(renderHook(() => livePremierLeague.useGameweekMatches(9)).result.current).toBe(matches);
  expect(convex.ofGameweek).toHaveBeenCalledWith({ gameweek: 9 });
});

// The page is asked without the minute, so it isn't read again every minute (#1550): its
// commentary's delay is judged here, at the screen's minute.
test("it asks match/matchPage:ofMatch with the league and the fixture code, and hands on the page, its commentary delayed once the screen's minute reaches the moment", () => {
  const page = { fixtureCode: 7, commentary: { kind: "read", lines: [], delayedFrom: NOW + 1 } };
  convex.ofMatch.mockReturnValue(page);
  const { result, rerender } = renderHook(({ minute }) => livePremierLeague.useMatch(A_LEAGUE_ID, minute, 7), { initialProps: { minute: NOW } });
  expect(result.current).toEqual({ fixtureCode: 7, commentary: { kind: "read", lines: [], delayed: false } });
  rerender({ minute: NOW + 1 });
  expect(result.current).toEqual({ fixtureCode: 7, commentary: { kind: "read", lines: [], delayed: true } });
  expect(convex.ofMatch).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, fixtureCode: 7 });
});

test("the match page is null while no match with its code is held", () => {
  convex.ofMatch.mockReturnValue(null);
  expect(renderHook(() => livePremierLeague.useMatch(A_LEAGUE_ID, NOW, 7)).result.current).toBeNull();
});

test("each is undefined while loading", () => {
  convex.firstKickoffs.mockReturnValue(undefined);
  convex.ofGameweek.mockReturnValue(undefined);
  expect(renderHook(() => livePremierLeague.useGameweeks()).result.current).toBeUndefined();
  expect(renderHook(() => livePremierLeague.useGameweekMatches(9)).result.current).toBeUndefined();
  convex.ofMatch.mockReturnValue(undefined);
  expect(renderHook(() => livePremierLeague.useMatch(A_LEAGUE_ID, NOW, 7)).result.current).toBeUndefined();
});

test("it asks football/plStandings:ofSeason with nothing, and hands on the table", () => {
  const table = { rows: [], provisional: false };
  convex.ofSeason.mockReturnValue(table);
  expect(renderHook(() => livePremierLeague.useStandings()).result.current).toBe(table);
  expect(convex.ofSeason).toHaveBeenCalledWith({});
});
