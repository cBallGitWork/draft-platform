// The squads seam's live wiring, with Convex's queries and mutations faked by name: which server
// function each part reads or calls, what a blank search asks of the server, and what a change
// resolves with when the server makes it, refuses it, or can't be reached.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { expect, test, vi } from "vitest";
import { silenceConsoleError } from "../../support/console.setup";
import type { Id } from "../../../convex/_generated/dataModel";
import { useLiveSquads } from "../../../src/squads/liveSquads";
import { squadChangeFailedWords } from "../../../src/squads/words";
import { A_LEAGUE_ID } from "../../support/src/convexReact.harness";

const convex = vi.hoisted(() => ({
  squads: vi.fn(),
  findPlayers: vi.fn(),
  assign: vi.fn(),
  move: vi.fn(),
  release: vi.fn(),
}));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "squads/squads:squads": convex.squads, "squads/squads:findPlayers": convex.findPlayers },
    mutations: { "squads/squads:assign": convex.assign, "squads/squads:move": convex.move, "squads/squads:release": convex.release },
  }),
);

const teamId = "team-2" as Id<"teams">;
const playerCode = 1001;
const seam = () => renderHook(() => useLiveSquads()).result.current;
const changeNames = ["assign", "move", "release"] as const;

test("a league's squads are read from squads/squads:squads", () => {
  const squads = { teams: [], unassigned: [] };
  convex.squads.mockReturnValue(squads);
  expect(renderHook(() => useLiveSquads().useSquads(A_LEAGUE_ID)).result.current).toBe(squads);
  expect(convex.squads).toHaveBeenLastCalledWith({ leagueId: A_LEAGUE_ID });
});

test("a search asks squads/squads:findPlayers, and blank text asks nothing and finds no one", () => {
  const found = [{ code: 1, name: "Saka", fullName: "Bukayo Saka", teamName: null }];
  convex.findPlayers.mockReturnValue(found);
  expect(renderHook(() => useLiveSquads().useFoundPlayers(A_LEAGUE_ID, "Saka")).result.current).toBe(found);
  expect(convex.findPlayers).toHaveBeenLastCalledWith({ leagueId: A_LEAGUE_ID, text: "Saka" });

  expect(renderHook(() => useLiveSquads().useFoundPlayers(A_LEAGUE_ID, "  ")).result.current).toEqual([]);
  expect(convex.findPlayers).toHaveBeenLastCalledWith("skip");
});

test.each([
  ["assigning", "assign", () => seam().assign(A_LEAGUE_ID, playerCode, teamId), { leagueId: A_LEAGUE_ID, playerCode, teamId }],
  ["moving", "move", () => seam().move(A_LEAGUE_ID, playerCode, teamId), { leagueId: A_LEAGUE_ID, playerCode, teamId }],
  ["releasing", "release", () => seam().release(A_LEAGUE_ID, playerCode), { leagueId: A_LEAGUE_ID, playerCode }],
] as const)("%s a player calls squads:%s alone, and resolves with no problem", async (_, name, change, args) => {
  convex[name].mockResolvedValue(null);
  expect(await change()).toBeNull();
  expect(convex[name]).toHaveBeenCalledExactlyOnceWith(args);
  for (const other of changeNames.filter((n) => n !== name)) {
    expect(convex[other]).not.toHaveBeenCalled();
  }
});

test("a change the server refuses resolves with the server's own words", async () => {
  const refusal = "Saka is already on Team 1. Move him instead.";
  convex.assign.mockRejectedValue(new ConvexError(refusal));
  expect(await seam().assign(A_LEAGUE_ID, playerCode, teamId)).toBe(refusal);
});

test("any other failure is logged and said plainly", async () => {
  const failure = new Error("offline");
  convex.release.mockRejectedValue(failure);
  const logged = silenceConsoleError();

  expect(await seam().release(A_LEAGUE_ID, playerCode)).toBe(squadChangeFailedWords);
  expect(logged).toHaveBeenCalledWith("Releasing a player failed:", failure);
});
