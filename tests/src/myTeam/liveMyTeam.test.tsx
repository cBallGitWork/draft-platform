// My team's seam's live wiring, with Convex's query faked by name: what it asks the server, and
// that it hands on what comes back as it comes.

import { renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { MINUTE_MS } from "../../../convex/shared/time";
import { liveMyTeam } from "../../../src/myTeam/liveMyTeam";

const convex = vi.hoisted(() => ({ ofMyTeam: vi.fn(), transactions: vi.fn(), squad: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "table/teamFixtures:ofMyTeam": convex.ofMyTeam, "squads/teamTransactions:ofMyTeam": convex.transactions, "squads/teamSquad:ofMyTeam": convex.squad },
  }),
);

afterEach(() => {
  convex.ofMyTeam.mockReset();
  convex.transactions.mockReset();
  convex.squad.mockReset();
});

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

test("it asks squads/teamTransactions:ofMyTeam for the league, and hands on what comes back", () => {
  const transactions = { transactions: [], cut: false };
  convex.transactions.mockReturnValue(transactions);
  expect(renderHook(() => liveMyTeam.useTeamTransactions(leagueId)).result.current).toBe(transactions);
  expect(convex.transactions).toHaveBeenCalledWith({ leagueId });
});

test("it asks squads/teamSquad:ofMyTeam for the league at the start of the current minute, and hands on what comes back", () => {
  const squad = { teamName: "Team 1", lastGameweek: null, players: [] };
  convex.squad.mockReturnValue(squad);
  expect(renderHook(() => liveMyTeam.useTeamSquad(leagueId)).result.current).toBe(squad);
  const [{ leagueId: asked, now }] = convex.squad.mock.calls[0];
  expect(asked).toBe(leagueId);
  expect(now % MINUTE_MS).toBe(0);
});
