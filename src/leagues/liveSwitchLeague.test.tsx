// Switching league's live wiring (#76), with Convex's mutation faked: what switching resolves
// with when the server switches, refuses, or can't be reached.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { afterEach, expect, test, vi } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { refusals } from "../../convex/leagueAccess";
import { useLiveLeagueActions } from "./liveLeagueActions";
import { switchFailedWords } from "./words";

const switchTo = vi.hoisted(() => vi.fn());
vi.mock("convex/react", () => ({ useMutation: () => switchTo }));

afterEach(() => {
  switchTo.mockReset();
  vi.restoreAllMocks();
});

const leagueId = "league-2" as Id<"leagues">;
const switchLeague = () => renderHook(useLiveLeagueActions).result.current.switchLeague(leagueId);

test("a switch the server makes resolves with no problem", async () => {
  switchTo.mockResolvedValue(null);
  expect(await switchLeague()).toBeNull();
  expect(switchTo).toHaveBeenCalledWith({ leagueId });
});

test("a switch the server refuses resolves with the server's own words", async () => {
  switchTo.mockRejectedValue(new ConvexError(refusals.notYourLeague));
  expect(await switchLeague()).toBe(refusals.notYourLeague);
});

test("any other failure is logged and said plainly", async () => {
  const failure = new Error("offline");
  switchTo.mockRejectedValue(failure);
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});

  expect(await switchLeague()).toBe(switchFailedWords);
  expect(logged).toHaveBeenCalledWith("Switching league failed:", failure);
});
