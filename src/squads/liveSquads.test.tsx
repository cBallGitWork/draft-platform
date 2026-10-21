// The squads seam's live wiring, with Convex's queries and mutations faked: what it reads, what a
// blank search asks of the server, and what a change resolves with when the server makes it,
// refuses it, or can't be reached.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { afterEach, expect, test, vi } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { useLiveSquads } from "./liveSquads";
import { changeFailedWords } from "./words";

const convex = vi.hoisted(() => ({ query: vi.fn(), change: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: convex.query, useMutation: () => convex.change }));

afterEach(() => {
  convex.query.mockReset();
  convex.change.mockReset();
  vi.restoreAllMocks();
});

const leagueId = "league-1" as Id<"leagues">;
const teamId = "team-2" as Id<"teams">;
const seam = () => renderHook(() => useLiveSquads()).result.current;

test("a search asks the server, and blank text asks nothing and finds no one", () => {
  const found = [{ code: 1, name: "Saka", fullName: "Bukayo Saka", teamName: null }];
  convex.query.mockReturnValue(found);
  expect(renderHook(() => useLiveSquads().useFoundPlayers(leagueId, "Saka")).result.current).toBe(found);
  expect(convex.query).toHaveBeenLastCalledWith(expect.anything(), { leagueId, text: "Saka" });

  expect(renderHook(() => useLiveSquads().useFoundPlayers(leagueId, "  ")).result.current).toEqual([]);
  expect(convex.query).toHaveBeenLastCalledWith(expect.anything(), "skip");
});

test("a change the server makes resolves with no problem", async () => {
  convex.change.mockResolvedValue(null);
  expect(await seam().assign(leagueId, 1001, teamId)).toBeNull();
  expect(convex.change).toHaveBeenCalledWith({ leagueId, playerCode: 1001, teamId });
});

test("a change the server refuses resolves with the server's own words", async () => {
  convex.change.mockRejectedValue(new ConvexError("Saka is already on Team 1. Move him instead."));
  expect(await seam().assign(leagueId, 1001, teamId)).toBe("Saka is already on Team 1. Move him instead.");
});

test("any other failure is logged and said plainly", async () => {
  const failure = new Error("offline");
  convex.change.mockRejectedValue(failure);
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});

  expect(await seam().release(leagueId, 1001)).toBe(changeFailedWords);
  expect(logged).toHaveBeenCalledWith("Releasing a player failed:", failure);
});
