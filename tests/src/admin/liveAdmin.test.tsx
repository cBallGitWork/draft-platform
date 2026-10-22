// The admin seam's live wiring, with Convex's queries and mutations faked by name: what a blank
// search asks of the server, and what a change resolves with when the server makes it, refuses it,
// or can't be reached.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { afterEach, expect, test, vi } from "vitest";
import { silenceConsoleError } from "../../support/console.setup";
import { useLiveAdmin } from "../../../src/admin/liveAdmin";
import { changeFailedWords } from "../../../src/admin/words";

const convex = vi.hoisted(() => ({ find: vi.fn(), setPosition: vi.fn(), approvePlayer: vi.fn(), approveClub: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "positions/playerPositions:find": convex.find },
    mutations: {
      "positions/playerPositions:approvePlayer": convex.approvePlayer,
      "positions/playerPositions:approveClub": convex.approveClub,
      "positions/playerPositions:setPosition": convex.setPosition,
      "positions/playerPositions:removePosition": vi.fn(),
      "positions/playerPositions:setApproveMode": vi.fn(),
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

test("a change positions/playerPositions:setPosition makes resolves with no problem", async () => {
  convex.setPosition.mockResolvedValue(null);
  expect(await seam().setPosition(3, "SS")).toBeNull();
  expect(convex.setPosition).toHaveBeenCalledWith({ code: 3, position: "SS" });
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
