// My team's seam's live wiring, with Convex's query faked by name: what it asks the server, and
// that it hands on what comes back as it comes.

import { renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { liveMyTeam } from "../../../src/myTeam/liveMyTeam";

const convex = vi.hoisted(() => ({ ofMyTeam: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "table/teamFixtures:ofMyTeam": convex.ofMyTeam },
  }),
);

afterEach(() => convex.ofMyTeam.mockReset());

const leagueId = "league-1" as Id<"leagues">;

test("it asks table/teamFixtures:ofMyTeam for the league, and hands on what comes back", () => {
  const fixtures = { teamName: "Team 1", format: "headToHead", games: [] };
  convex.ofMyTeam.mockReturnValue(fixtures);
  expect(renderHook(() => liveMyTeam.useTeamFixtures(leagueId)).result.current).toBe(fixtures);
  expect(convex.ofMyTeam).toHaveBeenCalledWith({ leagueId });
});

test("it is undefined while loading", () => {
  convex.ofMyTeam.mockReturnValue(undefined);
  expect(renderHook(() => liveMyTeam.useTeamFixtures(leagueId)).result.current).toBeUndefined();
});
