// The matchup's seam's live wiring, with Convex's query faked by name: what it asks the server, and
// that it hands on what comes back as it comes.

import { renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { liveMatchup } from "../../../src/matchup/liveMatchup";
import { A_LEAGUE_ID } from "../../support/src/convexReact.harness";

const convex = vi.hoisted(() => ({ ofTeam: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "matchup/matchup:ofTeam": convex.ofTeam },
  }),
);

const teamId = "team-1" as Id<"teams">;
const NOW = Date.parse("2026-10-27T16:00:00Z");

test("it asks matchup/matchup:ofTeam for the league, the minute and the matchup asked for, and hands on what comes back", () => {
  const matchup = { kind: "totalPoints" };
  convex.ofTeam.mockReturnValue(matchup);
  expect(renderHook(() => liveMatchup.useMatchup(A_LEAGUE_ID, NOW, { teamId, gameweek: 6 })).result.current).toBe(matchup);
  expect(convex.ofTeam).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, now: NOW, teamId, gameweek: 6 });
});

test("it is undefined while loading", () => {
  convex.ofTeam.mockReturnValue(undefined);
  expect(renderHook(() => liveMatchup.useMatchup(A_LEAGUE_ID, NOW, {})).result.current).toBeUndefined();
});
