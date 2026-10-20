// Switching league's live wiring (#76), with Convex's mutation faked: what switching resolves
// with when the server switches, refuses, or can't be reached.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { afterEach, expect, test, vi } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { notYourLeague } from "../../convex/lastLeague";
import { useLiveLeagueActions } from "./liveLeagueActions";
import { chooseFailedWords } from "./words";

const choose = vi.hoisted(() => vi.fn());
vi.mock("convex/react", () => ({ useMutation: () => choose }));

afterEach(() => {
  choose.mockReset();
  vi.restoreAllMocks();
});

const leagueId = "league-2" as Id<"leagues">;
const chooseLeague = () => renderHook(useLiveLeagueActions).result.current.chooseLeague(leagueId);

test("a switch the server makes resolves with no problem", async () => {
  choose.mockResolvedValue(null);
  expect(await chooseLeague()).toBeNull();
  expect(choose).toHaveBeenCalledWith({ leagueId });
});

test("a switch the server refuses resolves with the server's own words", async () => {
  choose.mockRejectedValue(new ConvexError(notYourLeague));
  expect(await chooseLeague()).toBe(notYourLeague);
});

test("any other failure is logged and said plainly", async () => {
  const failure = new Error("offline");
  choose.mockRejectedValue(failure);
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});

  expect(await chooseLeague()).toBe(chooseFailedWords);
  expect(logged).toHaveBeenCalledWith("Switching league failed:", failure);
});
