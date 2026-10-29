// The joining seam's live wiring, with Convex's hooks faked by name: what a change resolves with when the
// server makes it, refuses it, or can't be reached, and what asking for a link to join tells.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { expect, test, vi } from "vitest";
import { silenceConsoleError } from "../../support/console.setup";
import type { Id } from "../../../convex/_generated/dataModel";
import { linkOffWords } from "../../../convex/joining/joiningShared";
import { askFailedWords, replyWords } from "../../../src/signIn/words";
import { useLiveJoining } from "../../../src/joining/liveJoining";
import { changeFailedWords } from "../../../src/shared/words";

const convex = vi.hoisted(() => ({ send: vi.fn(), remove: vi.fn(), make: vi.fn(), ask: vi.fn(), signInToJoin: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    mutations: {
      "joining/invites:send": convex.send,
      "joining/invites:resend": vi.fn(),
      "joining/invites:cancel": vi.fn(),
      "leagues/teams:removeManager": convex.remove,
      "joining/inviteLink:make": convex.make,
      "joining/inviteLink:switchOff": vi.fn(),
      "joining/joinRequests:approve": vi.fn(),
      "joining/joinRequests:refuseRequest": vi.fn(),
      "joining/joinRequests:ask": convex.ask,
    },
    actions: { "joining/inviteLink:signInToJoin": convex.signInToJoin },
  }),
);

const joining = () => renderHook(useLiveJoining).result.current;
const leagueId = "league-1" as Id<"leagues">;

test("an invite joining/invites:send makes resolves with no problem, a new team asked for with no team", async () => {
  convex.send.mockResolvedValue(null);
  expect(await joining().invite(leagueId, "ann@example.com", null)).toBeNull();
  expect(convex.send).toHaveBeenCalledWith({ leagueId, email: "ann@example.com", teamId: undefined });
});

test("removing a manager asks leagues/teams:removeManager for the league and team, and resolves with no problem", async () => {
  convex.remove.mockResolvedValue(null);
  const teamId = "team-1" as Id<"teams">;
  expect(await joining().removeManager(leagueId, teamId)).toBeNull();
  expect(convex.remove).toHaveBeenCalledExactlyOnceWith({ leagueId, teamId });
});

test("a change the server refuses resolves with the server's own words", async () => {
  convex.make.mockRejectedValue(new ConvexError("Only the league's commissioner, its co-commissioner or the admin can do that."));
  expect(await joining().makeLink(leagueId)).toBe("Only the league's commissioner, its co-commissioner or the admin can do that.");
});

test("any other failure is logged and said plainly", async () => {
  const failure = new Error("offline");
  convex.ask.mockRejectedValue(failure);
  const logged = silenceConsoleError();

  expect(await joining().askToJoin("the-token")).toBe(changeFailedWords);
  expect(logged).toHaveBeenCalledWith("Asking to join failed:", failure);
});

test.each([
  ["the sign-in page's reply", async () => "checkYourEmail", replyWords.checkYourEmail],
  ["that the link no longer works", async () => "linkOff", linkOffWords],
  ["that it failed, when Convex couldn't answer", async () => Promise.reject(new Error("offline")), askFailedWords],
])("asking for a link to join tells %s", async (_, answer, words) => {
  convex.signInToJoin.mockImplementation(answer);
  silenceConsoleError();
  expect(await joining().signInToJoin("the-token", "ann@example.com")).toBe(words);
  expect(convex.signInToJoin).toHaveBeenCalledWith({ token: "the-token", email: "ann@example.com" });
});
