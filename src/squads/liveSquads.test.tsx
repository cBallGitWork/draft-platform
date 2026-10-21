// The squads seam's live wiring, with Convex's queries and mutations faked by name: which server
// function each part reads or calls, what a blank search asks of the server, and what a change
// resolves with when the server makes it, refuses it, or can't be reached.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { afterEach, expect, test, vi } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { useLiveSquads } from "./liveSquads";
import { changeFailedWords } from "./words";

const convex = vi.hoisted(() => ({
  squads: vi.fn(),
  findPlayers: vi.fn(),
  assign: vi.fn(),
  move: vi.fn(),
  release: vi.fn(),
}));
vi.mock("convex/react", async () =>
  (await import("../convexReact.harness")).fakeConvexReact({
    queries: { "squads:squads": convex.squads, "squads:findPlayers": convex.findPlayers },
    mutations: { "squads:assign": convex.assign, "squads:move": convex.move, "squads:release": convex.release },
  }),
);

afterEach(() => {
  for (const fake of Object.values(convex)) fake.mockReset();
  vi.restoreAllMocks();
});

const leagueId = "league-1" as Id<"leagues">;
const teamId = "team-2" as Id<"teams">;
const seam = () => renderHook(() => useLiveSquads()).result.current;

test("a league's squads are read from squads:squads", () => {
  const squads = { teams: [], unassigned: [] };
  convex.squads.mockReturnValue(squads);
  expect(renderHook(() => useLiveSquads().useSquads(leagueId)).result.current).toBe(squads);
  expect(convex.squads).toHaveBeenLastCalledWith({ leagueId });
});

test("a search asks squads:findPlayers, and blank text asks nothing and finds no one", () => {
  const found = [{ code: 1, name: "Saka", fullName: "Bukayo Saka", teamName: null }];
  convex.findPlayers.mockReturnValue(found);
  expect(renderHook(() => useLiveSquads().useFoundPlayers(leagueId, "Saka")).result.current).toBe(found);
  expect(convex.findPlayers).toHaveBeenLastCalledWith({ leagueId, text: "Saka" });

  expect(renderHook(() => useLiveSquads().useFoundPlayers(leagueId, "  ")).result.current).toEqual([]);
  expect(convex.findPlayers).toHaveBeenLastCalledWith("skip");
});

test.each([
  ["assigning", "assign", () => seam().assign(leagueId, 1001, teamId), { leagueId, playerCode: 1001, teamId }],
  ["moving", "move", () => seam().move(leagueId, 1001, teamId), { leagueId, playerCode: 1001, teamId }],
  ["releasing", "release", () => seam().release(leagueId, 1001), { leagueId, playerCode: 1001 }],
] as const)("%s a player calls squads:%s alone, and resolves with no problem", async (_, name, change, args) => {
  convex[name].mockResolvedValue(null);
  expect(await change()).toBeNull();
  expect(convex[name]).toHaveBeenCalledExactlyOnceWith(args);
  for (const other of (["assign", "move", "release"] as const).filter((n) => n !== name)) {
    expect(convex[other]).not.toHaveBeenCalled();
  }
});

test("a change the server refuses resolves with the server's own words", async () => {
  convex.assign.mockRejectedValue(new ConvexError("Saka is already on Team 1. Move him instead."));
  expect(await seam().assign(leagueId, 1001, teamId)).toBe("Saka is already on Team 1. Move him instead.");
});

test("any other failure is logged and said plainly", async () => {
  const failure = new Error("offline");
  convex.release.mockRejectedValue(failure);
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});

  expect(await seam().release(leagueId, 1001)).toBe(changeFailedWords);
  expect(logged).toHaveBeenCalledWith("Releasing a player failed:", failure);
});
