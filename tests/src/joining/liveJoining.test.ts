// The joining seam's live wiring, with Convex's hooks faked: what a change resolves with when the
// server makes it, refuses it, or can't be reached, and what asking for a link to join tells.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { afterEach, expect, test, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { linkOffWords } from "../../../convex/joining/joiningShared";
import { askFailedWords, replyWords } from "../../../src/sign-in/words";
import { useLiveJoining } from "../../../src/joining/liveJoining";
import { changeFailedWords } from "../../../src/joining/words";

const convex = vi.hoisted(() => ({ mutation: vi.fn(), action: vi.fn() }));
vi.mock("convex/react", () => ({ useMutation: () => convex.mutation, useAction: () => convex.action, useQuery: vi.fn() }));

afterEach(() => {
  convex.mutation.mockReset();
  convex.action.mockReset();
  vi.restoreAllMocks();
});

const joining = () => renderHook(useLiveJoining).result.current;
const leagueId = "league-1" as Id<"leagues">;

test("a change the server makes resolves with no problem, a new team asked for with no team", async () => {
  convex.mutation.mockResolvedValue(null);
  expect(await joining().invite(leagueId, "ann@example.com", null)).toBeNull();
  expect(convex.mutation).toHaveBeenCalledWith({ leagueId, email: "ann@example.com", teamId: undefined });
});

test("a change the server refuses resolves with the server's own words", async () => {
  convex.mutation.mockRejectedValue(new ConvexError("Only the league's commissioner, its co-commissioner or the admin can do that."));
  expect(await joining().makeLink(leagueId)).toBe("Only the league's commissioner, its co-commissioner or the admin can do that.");
});

test("any other failure is logged and said plainly", async () => {
  const failure = new Error("offline");
  convex.mutation.mockRejectedValue(failure);
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});

  expect(await joining().askToJoin("the-token")).toBe(changeFailedWords);
  expect(logged).toHaveBeenCalledWith("Asking to join failed:", failure);
});

test.each([
  ["the sign-in page's reply", async () => "checkYourEmail", replyWords.checkYourEmail],
  ["that the link no longer works", async () => "linkOff", linkOffWords],
  ["that it failed, when Convex couldn't answer", async () => Promise.reject(new Error("offline")), askFailedWords],
])("asking for a link to join tells %s", async (_, answer, words) => {
  convex.action.mockImplementation(answer);
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(await joining().signInToJoin("the-token", "ann@example.com")).toBe(words);
  expect(convex.action).toHaveBeenCalledWith({ token: "the-token", email: "ann@example.com" });
});
