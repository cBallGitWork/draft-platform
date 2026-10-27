// The leagues seam's live wiring, with Convex's mutation faked: what creating a league resolves
// with when the server makes it, refuses it, or can't be reached, deleting one and undoing it, and
// switching league (#76).

import { renderHook } from "@testing-library/react";
import type { Id } from "../../../convex/_generated/dataModel";
import { ConvexError } from "convex/values";
import { refusals } from "../../../convex/shared/leagueAccess";
import { afterEach, expect, test, vi } from "vitest";
import { silenceConsoleError } from "../../support/console.setup";
import { useLiveLeagues } from "../../../src/leagues/liveLeagues";
import { createFailedWords, deleteFailedWords, leaveFailedWords, switchFailedWords, undoFailedWords } from "../../../src/leagues/words";

const create = vi.hoisted(() => vi.fn());
const deleteLeague = vi.hoisted(() => vi.fn());
const undo = vi.hoisted(() => vi.fn());
const switchTo = vi.hoisted(() => vi.fn());
const leave = vi.hoisted(() => vi.fn());
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    mutations: {
      "leagues/leagues:create": create,
      "leagues/leagueDeletion:deleteLeague": deleteLeague,
      "leagues/leagueDeletion:undo": undo,
      "leagues/lastLeague:switchTo": switchTo,
      "leagues/teams:leave": leave,
    },
  }),
);

afterEach(() => {
  for (const mutation of [create, deleteLeague, undo, switchTo, leave]) mutation.mockReset();
});

const newLeague = { name: "Mini beta", maxTeams: 4, commissionerEmail: "commish@example.com" };
const createLeague = () => renderHook(useLiveLeagues).result.current.createLeague(newLeague);

test("a league the server makes resolves with no problem", async () => {
  create.mockResolvedValue("league-id");
  expect(await createLeague()).toBeNull();
  expect(create).toHaveBeenCalledWith(newLeague);
});

test("a league the server refuses resolves with the server's own words", async () => {
  create.mockRejectedValue(new ConvexError("Only the admin can do that."));
  expect(await createLeague()).toBe("Only the admin can do that.");
});

test("any other failure is logged and said plainly", async () => {
  const failure = new Error("offline");
  create.mockRejectedValue(failure);
  const logged = silenceConsoleError();

  expect(await createLeague()).toBe(createFailedWords);
  expect(logged).toHaveBeenCalledWith("Creating a league failed:", failure);
});

const leagueId = "league-1" as Id<"leagues">;
const liveActions = () => renderHook(useLiveLeagues).result.current;

test.each([
  ["deleting", () => liveActions().deleteLeague(leagueId), deleteLeague],
  ["undoing", () => liveActions().undoDeletion(leagueId), undo],
  ["switching to", () => liveActions().switchLeague(leagueId), switchTo],
  ["leaving", () => liveActions().leaveLeague(leagueId), leave],
])("%s a league asks the server with its id, and resolves with no problem", async (_, change, mutation) => {
  mutation.mockResolvedValue(null);
  expect(await change()).toBeNull();
  expect(mutation).toHaveBeenCalledExactlyOnceWith({ leagueId });
});

test.each([
  ["Deleting a league", () => liveActions().deleteLeague(leagueId), deleteLeague, deleteFailedWords],
  ["Undoing a league's deletion", () => liveActions().undoDeletion(leagueId), undo, undoFailedWords],
  ["Switching league", () => liveActions().switchLeague(leagueId), switchTo, switchFailedWords],
  ["Leaving a league", () => liveActions().leaveLeague(leagueId), leave, leaveFailedWords],
])("%s failing for any other reason is logged and said plainly", async (doing, change, mutation, words) => {
  const failure = new Error("offline");
  mutation.mockRejectedValue(failure);
  const logged = silenceConsoleError();

  expect(await change()).toBe(words);
  expect(logged).toHaveBeenCalledWith(`${doing} failed:`, failure);
});

test("a switch the server refuses resolves with the server's own words", async () => {
  switchTo.mockRejectedValue(new ConvexError(refusals.notInLeague));
  expect(await liveActions().switchLeague(leagueId)).toBe(refusals.notInLeague);
});

test("leaving a league the server refuses resolves with the server's own words", async () => {
  leave.mockRejectedValue(new ConvexError(refusals.runsNoTeam));
  expect(await liveActions().leaveLeague(leagueId)).toBe(refusals.runsNoTeam);
});
