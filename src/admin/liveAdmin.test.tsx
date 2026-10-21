// The admin seam's live wiring, with Convex's queries and mutations faked: what a blank search
// asks of the server, and what a change resolves with when the server makes it, refuses it, or
// can't be reached.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { afterEach, expect, test, vi } from "vitest";
import { useLiveAdmin } from "./liveAdmin";
import { changeFailedWords } from "./words";

const convex = vi.hoisted(() => ({ query: vi.fn(), change: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: convex.query, useMutation: () => convex.change }));

afterEach(() => {
  convex.query.mockReset();
  convex.change.mockReset();
  vi.restoreAllMocks();
});

const seam = () => renderHook(() => useLiveAdmin()).result.current;

test("a search asks the server, and blank text asks nothing and finds no one", () => {
  const found = [{ code: 3, name: "Woltemade", fullName: "Nick Woltemade", clubCode: 4, positions: [] }];
  convex.query.mockReturnValue(found);
  expect(renderHook(() => useLiveAdmin().useFoundPlayers("Woltemade")).result.current).toBe(found);
  expect(convex.query).toHaveBeenLastCalledWith(expect.anything(), { text: "Woltemade" });

  expect(renderHook(() => useLiveAdmin().useFoundPlayers("  ")).result.current).toEqual([]);
  expect(convex.query).toHaveBeenLastCalledWith(expect.anything(), "skip");
});

test("a change the server makes resolves with no problem", async () => {
  convex.change.mockResolvedValue(null);
  expect(await seam().setPosition(3, "SS")).toBeNull();
  expect(convex.change).toHaveBeenCalledWith({ code: 3, position: "SS" });
});

test("a change the server refuses resolves with the server's own words", async () => {
  convex.change.mockRejectedValue(new ConvexError("Only the admin can do that."));
  expect(await seam().approvePlayer(3)).toBe("Only the admin can do that.");
});

test("any other failure is logged and said plainly", async () => {
  const failure = new Error("offline");
  convex.change.mockRejectedValue(failure);
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});

  expect(await seam().approveClub(4)).toBe(changeFailedWords);
  expect(logged).toHaveBeenCalledWith("Approving a club failed:", failure);
});
