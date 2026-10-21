// The leagues seam's live wiring, with Convex's mutation faked: what creating a league resolves
// with when the server makes it, refuses it, or can't be reached.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { afterEach, expect, test, vi } from "vitest";
import { useLiveLeagueActions } from "./liveLeagueActions";
import { createFailedWords } from "./words";

const create = vi.hoisted(() => vi.fn());
vi.mock("convex/react", () => ({ useMutation: () => create }));

afterEach(() => {
  create.mockReset();
  vi.restoreAllMocks();
});

const newLeague = { name: "Mini beta", maxTeams: 4, commissionerEmail: "commish@example.com" };
const createLeague = () => renderHook(useLiveLeagueActions).result.current.createLeague(newLeague);

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
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});

  expect(await createLeague()).toBe(createFailedWords);
  expect(logged).toHaveBeenCalledWith("Creating a league failed:", failure);
});
