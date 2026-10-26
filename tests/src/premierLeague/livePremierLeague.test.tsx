// The Premier League seam's live wiring, with Convex's queries faked by name: what it asks the
// server, and that it hands on what comes back as it comes.

import { renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { livePremierLeague } from "../../../src/premierLeague/livePremierLeague";
import { ARSENAL, CHELSEA, plMatch } from "../../support/src/premierLeague.harness";

const convex = vi.hoisted(() => ({ firstKickoffs: vi.fn(), ofGameweek: vi.fn(), ofSeason: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "football/plGameweeks:firstKickoffs": convex.firstKickoffs, "football/matchScores:ofGameweek": convex.ofGameweek, "football/plStandings:ofSeason": convex.ofSeason },
  }),
);

afterEach(() => {
  convex.firstKickoffs.mockReset();
  convex.ofGameweek.mockReset();
  convex.ofSeason.mockReset();
});

test("it asks football/plGameweeks:firstKickoffs with nothing, and hands on what comes back", () => {
  const kickoffs = [{ gameweek: 1, firstKickoff: 1_000 }];
  convex.firstKickoffs.mockReturnValue(kickoffs);
  expect(renderHook(() => livePremierLeague.useFirstKickoffs()).result.current).toBe(kickoffs);
  expect(convex.firstKickoffs).toHaveBeenCalledWith({});
});

test("it asks football/matchScores:ofGameweek with the gameweek, and hands on what comes back", () => {
  const matches = [plMatch(1, ARSENAL, CHELSEA, 1_000)];
  convex.ofGameweek.mockReturnValue(matches);
  expect(renderHook(() => livePremierLeague.useGameweekMatches(9)).result.current).toBe(matches);
  expect(convex.ofGameweek).toHaveBeenCalledWith({ gameweek: 9 });
});

test("each is undefined while loading", () => {
  convex.firstKickoffs.mockReturnValue(undefined);
  convex.ofGameweek.mockReturnValue(undefined);
  expect(renderHook(() => livePremierLeague.useFirstKickoffs()).result.current).toBeUndefined();
  expect(renderHook(() => livePremierLeague.useGameweekMatches(9)).result.current).toBeUndefined();
});

test("it asks football/plStandings:ofSeason with nothing, and hands on the table", () => {
  const table = { rows: [], provisional: false };
  convex.ofSeason.mockReturnValue(table);
  expect(renderHook(() => livePremierLeague.useStandings()).result.current).toBe(table);
  expect(convex.ofSeason).toHaveBeenCalledWith({});
});
