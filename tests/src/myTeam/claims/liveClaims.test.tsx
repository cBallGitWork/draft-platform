// The claims seam's live wiring, with Convex's queries faked by name: the pending claims are read
// with no minute, and each claim's run is judged at the minute from the hour's waiver clock (#2008).

import { renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { liveClaims } from "../../../../src/myTeam/claims/liveClaims";
import { A_LEAGUE_ID } from "../../../support/src/convexReact.harness";
import { GAMEWEEK_12_CLOCK, THURSDAYS_RUN, WEDNESDAY_NOON } from "../../../support/src/waiverClock.harness";

const convex = vi.hoisted(() => ({ pending: vi.fn(), clock: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "waivers/waiverClaims:pending": convex.pending, "waivers/waiverClock:clockOf": convex.clock },
  }),
);

const CLAIM = { claimId: "claim", teamId: "team", teamName: "Team 1", yours: true, claim: { playerCode: 7 }, drop: null };

test("pending claims are read with no minute, each with the run that can first take its player judged at the minute, null once he is off waivers (S08.14)", () => {
  vi.useFakeTimers({ now: WEDNESDAY_NOON });
  convex.pending.mockReturnValue([
    { ...CLAIM, claimableFrom: 0 },
    { ...CLAIM, claimId: "gone", claimableFrom: null },
  ]);
  convex.clock.mockReturnValue(GAMEWEEK_12_CLOCK);
  expect(renderHook(() => liveClaims.usePendingClaims(A_LEAGUE_ID)).result.current).toEqual([
    { ...CLAIM, run: THURSDAYS_RUN },
    { ...CLAIM, claimId: "gone", run: null },
  ]);
  expect(convex.pending).toHaveBeenLastCalledWith({ leagueId: A_LEAGUE_ID });
  expect(convex.clock).toHaveBeenLastCalledWith({ leagueId: A_LEAGUE_ID, hour: WEDNESDAY_NOON });
  vi.useRealTimers();
});

test("the pending claims stay loading until the waiver clock has loaded, so no claim shows without its run (S08.14)", () => {
  convex.pending.mockReturnValue([{ ...CLAIM, claimableFrom: 0 }]);
  convex.clock.mockReturnValue(undefined);
  expect(renderHook(() => liveClaims.usePendingClaims(A_LEAGUE_ID)).result.current).toBeUndefined();
});
