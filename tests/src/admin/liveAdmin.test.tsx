// The admin seam's live wiring, with Convex's queries and mutations faked by name: what a blank
// search asks of the server, the time the feeds are judged at, and what a change resolves with when
// the server makes it, refuses it, or can't be reached.

import { act, renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { afterEach, expect, test, vi } from "vitest";
import { silenceConsoleError } from "../../support/console.setup";
import { useLiveAdmin } from "../../../src/admin/liveAdmin";
import { changeFailedWords } from "../../../src/words";
import { MINUTE_MS } from "../../../convex/shared/time";

const convex = vi.hoisted(() => ({ find: vi.fn(), feeds: vi.fn(), setPosition: vi.fn(), approvePlayer: vi.fn(), approveClub: vi.fn(), setChangeThresholds: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "positions/playerPositions:find": convex.find, "admin/feeds:feeds": convex.feeds },
    mutations: {
      "positions/playerPositions:approvePlayer": convex.approvePlayer,
      "positions/playerPositions:approveClub": convex.approveClub,
      "positions/playerPositions:setPosition": convex.setPosition,
      "positions/playerPositions:removePosition": vi.fn(),
      "positions/positionSettings:setApproveMode": vi.fn(),
      "positions/positionSettings:setChangeThresholds": convex.setChangeThresholds,
    },
  }),
);

afterEach(() => {
  for (const fake of Object.values(convex)) fake.mockReset();
});

const seam = () => renderHook(() => useLiveAdmin()).result.current;

test("a search asks positions/playerPositions:find, and blank text asks nothing and finds no one", () => {
  const found = [{ code: 3, name: "Woltemade", fullName: "Nick Woltemade", clubCode: 4, positions: [] }];
  convex.find.mockReturnValue(found);
  expect(renderHook(() => useLiveAdmin().useFoundPlayers("Woltemade")).result.current).toBe(found);
  expect(convex.find).toHaveBeenLastCalledWith({ text: "Woltemade" });

  expect(renderHook(() => useLiveAdmin().useFoundPlayers("  ")).result.current).toEqual([]);
  expect(convex.find).toHaveBeenLastCalledWith("skip");
});

test("the feeds are asked of admin/feeds:feeds at the start of the minute, and asked again when the next begins", () => {
  const minute = Date.parse("2026-10-17T12:00:00Z");
  vi.useFakeTimers({ now: minute + 40_000 });
  renderHook(() => useLiveAdmin().useFeeds());
  expect(convex.feeds).toHaveBeenLastCalledWith({ now: minute });

  act(() => vi.advanceTimersByTime(19_999));
  expect(convex.feeds).toHaveBeenLastCalledWith({ now: minute });
  act(() => vi.advanceTimersByTime(1));
  expect(convex.feeds).toHaveBeenLastCalledWith({ now: minute + MINUTE_MS });
  act(() => vi.advanceTimersByTime(MINUTE_MS));
  expect(convex.feeds).toHaveBeenLastCalledWith({ now: minute + 2 * MINUTE_MS });
});

test("a change positions/playerPositions:setPosition makes resolves with no problem", async () => {
  convex.setPosition.mockResolvedValue(null);
  expect(await seam().setPosition(3, "SS")).toBeNull();
  expect(convex.setPosition).toHaveBeenCalledWith({ code: 3, position: "SS" });
});

test("new thresholds go to positions/positionSettings:setChangeThresholds", async () => {
  convex.setChangeThresholds.mockResolvedValue(null);
  expect(await seam().setChangeThresholds({ flagAfter: 2, removeAfter: 5 })).toBeNull();
  expect(convex.setChangeThresholds).toHaveBeenCalledWith({ flagAfter: 2, removeAfter: 5 });
});

test("a change the server refuses resolves with the server's own words", async () => {
  convex.approvePlayer.mockRejectedValue(new ConvexError("Only the admin can do that."));
  expect(await seam().approvePlayer(3)).toBe("Only the admin can do that.");
});

test("any other failure is logged and said plainly", async () => {
  const failure = new Error("offline");
  convex.approveClub.mockRejectedValue(failure);
  const logged = silenceConsoleError();

  expect(await seam().approveClub(4)).toBe(changeFailedWords);
  expect(logged).toHaveBeenCalledWith("Approving a club failed:", failure);
});
