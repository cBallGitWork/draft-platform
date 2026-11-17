// My team's seam's live wiring, with Convex's query faked by name: what it asks the server, and
// that it hands on what comes back as it comes.

import { act, renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { expect, test, vi } from "vitest";
import { MINUTE_MS, SECOND_MS } from "../../../convex/shared/time";
import { liveMyTeam } from "../../../src/myTeam/liveMyTeam";
import { squadNumberRefusals } from "../../../convex/squads/squadNumbers";
import { A_LEAGUE_ID } from "../../support/src/convexReact.harness";

const convex = vi.hoisted(() => ({ ofMyTeam: vi.fn(), transactions: vi.fn(), squad: vi.fn(), setNumber: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "table/teamFixtures:ofMyTeam": convex.ofMyTeam, "squads/teamTransactions:ofMyTeam": convex.transactions, "squads/teamSquad:ofMyTeam": convex.squad },
    mutations: { "squads/squadNumbers:set": convex.setNumber },
  }),
);


test("it asks table/teamFixtures:ofMyTeam for the league, and hands on what comes back", () => {
  const fixtures = { teamId: "team-1", teamName: "Team 1", format: "headToHead", games: [], unscored: [] };
  convex.ofMyTeam.mockReturnValue(fixtures);
  expect(renderHook(() => liveMyTeam.useTeamFixtures(A_LEAGUE_ID)).result.current).toBe(fixtures);
  expect(convex.ofMyTeam).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID });
});

test("it is undefined while loading", () => {
  convex.ofMyTeam.mockReturnValue(undefined);
  expect(renderHook(() => liveMyTeam.useTeamFixtures(A_LEAGUE_ID)).result.current).toBeUndefined();
});

test("it asks squads/teamTransactions:ofMyTeam for the league, and hands on what comes back", () => {
  const transactions = { transactions: [], cut: false };
  convex.transactions.mockReturnValue(transactions);
  expect(renderHook(() => liveMyTeam.useTeamTransactions(A_LEAGUE_ID)).result.current).toBe(transactions);
  expect(convex.transactions).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID });
});

test("it asks squads/teamSquad:ofMyTeam for the league for the current hour, and a minute's turn asks for the same hour (#2008)", () => {
  vi.useFakeTimers({ now: Date.parse("2026-11-17T12:00:00Z") + SECOND_MS });
  try {
    const squad = { teamName: "Team 1", lastGameweek: null, players: [], scheduleGameweeks: [] };
    convex.squad.mockImplementation(({ hour }: { hour: number }) => ({ ...squad, scheduleFrom: [{ from: hour, gameweek: null }] }));
    const { result } = renderHook(() => liveMyTeam.useTeamSquad(A_LEAGUE_ID));
    expect(result.current).toEqual(squad);
    act(() => vi.advanceTimersByTime(MINUTE_MS));
    expect(convex.squad.mock.calls.length).toBeGreaterThan(1);
    const asked = new Set(convex.squad.mock.calls.map(([{ leagueId, hour }]) => [leagueId, hour].join()));
    expect(asked).toEqual(new Set([[A_LEAGUE_ID, Date.parse("2026-11-17T12:00:00Z")].join()]));
  } finally {
    vi.useRealTimers();
  }
});

test("a squad number is set through squads/squadNumbers:set, and a refusal comes back as the server's words (#13)", async () => {
  const { set } = renderHook(() => liveMyTeam.useSquadNumbers()).result.current;
  convex.setNumber.mockResolvedValue(null);
  expect(await set(A_LEAGUE_ID, 1001, 7)).toBeNull();
  expect(convex.setNumber).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, playerCode: 1001, number: 7 });
  convex.setNumber.mockRejectedValue(new ConvexError(squadNumberRefusals.notInSquad));
  expect(await set(A_LEAGUE_ID, 1001, null)).toBe(squadNumberRefusals.notInSquad);
});
