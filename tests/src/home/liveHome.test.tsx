// The league home seam's live wiring, with Convex's query faked by name: what it asks the server,
// and that it hands on what comes back as it comes.

import { renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { liveHome } from "../../../src/home/liveHome";
import { gameweekOneRecap, quietHome } from "../../support/src/home.harness";
import { A_LEAGUE_ID } from "../../support/src/convexReact.harness";

const convex = vi.hoisted(() => ({ ofLeague: vi.fn(), ofGameweek: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "home/leagueHome:ofLeague": convex.ofLeague, "home/recaps:ofGameweek": convex.ofGameweek },
  }),
);

test("its recap asks home/recaps:ofGameweek with the league and the gameweek, and hands on what comes back", () => {
  convex.ofGameweek.mockReturnValue(gameweekOneRecap);
  expect(renderHook(() => liveHome.useRecap(A_LEAGUE_ID, 1)).result.current).toBe(gameweekOneRecap);
  expect(convex.ofGameweek).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, gameweek: 1 });
});

const now = 1_000_000;

test("it asks home/leagueHome:ofLeague with the league and the minute, and hands on what comes back", () => {
  convex.ofLeague.mockReturnValue(quietHome);
  expect(renderHook(() => liveHome.useLeagueHome(A_LEAGUE_ID, now)).result.current).toBe(quietHome);
  expect(convex.ofLeague).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, now });
});

test("it is undefined while loading", () => {
  convex.ofLeague.mockReturnValue(undefined);
  expect(renderHook(() => liveHome.useLeagueHome(A_LEAGUE_ID, now)).result.current).toBeUndefined();
});
