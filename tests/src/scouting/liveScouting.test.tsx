// The Scouting seam's live wiring, with Convex's query faked by name: what it asks the server, and
// that it hands on what comes back as it comes.

import { renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { PlayersFilters, PlayersSort } from "../../../convex/scouting/playersList";
import { liveScouting } from "../../../src/scouting/liveScouting";

const convex = vi.hoisted(() => ({ list: vi.fn(), compare: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "scouting/playersList:list": convex.list, "scouting/compare:players": convex.compare },
  }),
);

afterEach(() => {
  convex.list.mockReset();
  convex.compare.mockReset();
});

const leagueId = "league-1" as Id<"leagues">;
const filters: PlayersFilters = { availability: "freeAgents", position: "CB", clubCode: 3 };
const sort: PlayersSort = { by: "club", descending: true };

const stat = "goals_scored";

test("it asks scouting/playersList:list with the league, the filters, the sort and the shown stat, and hands on what comes back", () => {
  const list = { clubs: [], players: [] };
  convex.list.mockReturnValue(list);
  expect(renderHook(() => liveScouting.usePlayersList(leagueId, filters, sort, stat)).result.current).toBe(list);
  expect(convex.list).toHaveBeenCalledWith({ leagueId, filters, sort, stat });
});

test("it is undefined while loading", () => {
  convex.list.mockReturnValue(undefined);
  expect(renderHook(() => liveScouting.usePlayersList(leagueId, filters, sort, null)).result.current).toBeUndefined();
});

test("it asks scouting/compare:players for the two codes, and hands on what comes back", () => {
  const comparison = [{ code: 1 }, { code: 2 }];
  convex.compare.mockReturnValue(comparison);
  expect(renderHook(() => liveScouting.useComparison(leagueId, [1, 2])).result.current).toBe(comparison);
  expect(convex.compare).toHaveBeenCalledWith({ leagueId, codes: [1, 2] });
});

test("with no codes it skips the query", () => {
  expect(renderHook(() => liveScouting.useComparison(leagueId, null)).result.current).toBeUndefined();
  expect(convex.compare).toHaveBeenCalledWith("skip");
});
