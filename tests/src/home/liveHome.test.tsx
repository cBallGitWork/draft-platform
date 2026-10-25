// The league home seam's live wiring, with Convex's query faked by name: what it asks the server,
// and that it hands on what comes back as it comes.

import { renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { liveHome } from "../../../src/home/liveHome";
import { quietHome } from "../../support/src/home.harness";

const convex = vi.hoisted(() => ({ ofLeague: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "home/leagueHome:ofLeague": convex.ofLeague },
  }),
);

afterEach(() => convex.ofLeague.mockReset());

const leagueId = "league-1" as Id<"leagues">;
const now = 1_000_000;

test("it asks home/leagueHome:ofLeague with the league and the minute, and hands on what comes back", () => {
  convex.ofLeague.mockReturnValue(quietHome);
  expect(renderHook(() => liveHome.useLeagueHome(leagueId, now)).result.current).toBe(quietHome);
  expect(convex.ofLeague).toHaveBeenCalledWith({ leagueId, now });
});

test("it is undefined while loading", () => {
  convex.ofLeague.mockReturnValue(undefined);
  expect(renderHook(() => liveHome.useLeagueHome(leagueId, now)).result.current).toBeUndefined();
});
