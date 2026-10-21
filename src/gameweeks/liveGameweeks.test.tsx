// The gameweeks seam's live wiring, with Convex's query and mutation faked: what it reads, and
// what ticking resolves with when the server does it, refuses it, or can't be reached.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { afterEach, expect, test, vi } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { season } from "./gameweeks.harness";
import { liveGameweeks } from "./liveGameweeks";
import { setFailedWords } from "./words";

const convex = vi.hoisted(() => ({ query: vi.fn(), set: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: convex.query, useMutation: () => convex.set }));

afterEach(() => {
  convex.query.mockReset();
  convex.set.mockReset();
  vi.restoreAllMocks();
});

const leagueId = "league-1" as Id<"leagues">;
const REFUSAL = "Gameweek 3 has begun, so it can't be ticked or unticked.";
const view = () => renderHook(() => liveGameweeks.useLeagueGameweeks(leagueId)).result.current;

test("it reads the league's gameweeks from the server, as they come", () => {
  const gameweeks = season();
  convex.query.mockReturnValue(gameweeks);
  expect(view().gameweeks).toBe(gameweeks);
  expect(convex.query).toHaveBeenCalledWith(expect.anything(), { leagueId });
});

test("a tick the server makes resolves with no problem", async () => {
  convex.set.mockResolvedValue(null);
  expect(await view().setUsed(17, false)).toBeNull();
  expect(convex.set).toHaveBeenCalledWith({ leagueId, gameweek: 17, used: false });
});

test("a tick the server refuses resolves with the server's own words", async () => {
  convex.set.mockRejectedValue(new ConvexError(REFUSAL));
  expect(await view().setUsed(3, false)).toBe(REFUSAL);
});

test("any other failure is logged and said plainly", async () => {
  const failure = new Error("offline");
  convex.set.mockRejectedValue(failure);
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});

  expect(await view().setUsed(17, true)).toBe(setFailedWords);
  expect(logged).toHaveBeenCalledWith("Ticking gameweek 17 failed:", failure);
});
