// The gameweeks seam's live wiring, with Convex's query and mutation faked by name: what it reads, and
// what ticking resolves with when the server does it, refuses it, or can't be reached.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { afterEach, expect, test, vi } from "vitest";
import { silenceConsoleError } from "../../support/console.setup";
import type { Id } from "../../../convex/_generated/dataModel";
import { season } from "../../support/src/gameweeks.harness";
import { liveGameweeks } from "../../../src/gameweeks/liveGameweeks";
import { setFailedWords } from "../../../src/gameweeks/words";

const convex = vi.hoisted(() => ({ ofLeague: vi.fn(), setUsed: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "gameweeks/leagueGameweeks:ofLeague": convex.ofLeague },
    mutations: { "gameweeks/leagueGameweeks:setUsed": convex.setUsed },
  }),
);

afterEach(() => {
  convex.ofLeague.mockReset();
  convex.setUsed.mockReset();
});

const leagueId = "league-1" as Id<"leagues">;
const REFUSAL = "Gameweek 3 has begun, so it can't be ticked or unticked.";
const view = () => renderHook(() => liveGameweeks.useLeagueGameweeks(leagueId)).result.current;

test("it reads the league's gameweeks from gameweeks/leagueGameweeks:ofLeague, as they come", () => {
  const gameweeks = season();
  convex.ofLeague.mockReturnValue(gameweeks);
  expect(view().gameweeks).toBe(gameweeks);
  expect(convex.ofLeague).toHaveBeenCalledWith({ leagueId });
});

test("a tick gameweeks/leagueGameweeks:setUsed makes resolves with no problem", async () => {
  convex.setUsed.mockResolvedValue(null);
  expect(await view().setUsed(17, false)).toBeNull();
  expect(convex.setUsed).toHaveBeenCalledWith({ leagueId, gameweek: 17, used: false });
});

test("a tick the server refuses resolves with the server's own words", async () => {
  convex.setUsed.mockRejectedValue(new ConvexError(REFUSAL));
  expect(await view().setUsed(3, false)).toBe(REFUSAL);
});

test("any other failure is logged and said plainly", async () => {
  const failure = new Error("offline");
  convex.setUsed.mockRejectedValue(failure);
  const logged = silenceConsoleError();

  expect(await view().setUsed(17, true)).toBe(setFailedWords);
  expect(logged).toHaveBeenCalledWith("Ticking gameweek 17 failed:", failure);
});
