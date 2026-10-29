// The Scouting seam's live wiring, with Convex's query faked by name: what it asks the server, and
// that it hands on what comes back as it comes.

import { renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { PlayersFilters, PlayersSort } from "../../../convex/scouting/playersList";
import { liveScouting } from "../../../src/scouting/liveScouting";
import { A_LEAGUE_ID } from "../../support/src/convexReact.harness";

const convex = vi.hoisted(() => ({ list: vi.fn(), compare: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "scouting/playersList:list": convex.list, "scouting/compare:players": convex.compare },
  }),
);

const filters: PlayersFilters = { availability: "freeAgents", position: "CB", clubCode: 3 };
const sort: PlayersSort = { by: "club", descending: true };

const stat = "goals_scored";

test("it asks scouting/playersList:list with the league, the filters, the sort and the shown stat, and hands on what comes back", () => {
  const list = { clubs: [], players: [] };
  convex.list.mockReturnValue(list);
  expect(renderHook(() => liveScouting.usePlayersList(A_LEAGUE_ID, filters, sort, stat)).result.current).toBe(list);
  expect(convex.list).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, filters, sort, stat });
});

test("it is undefined while loading", () => {
  convex.list.mockReturnValue(undefined);
  expect(renderHook(() => liveScouting.usePlayersList(A_LEAGUE_ID, filters, sort, null)).result.current).toBeUndefined();
});

test("it asks scouting/compare:players for the two codes, and hands on what comes back", () => {
  const comparison = [{ code: 1 }, { code: 2 }];
  convex.compare.mockReturnValue(comparison);
  expect(renderHook(() => liveScouting.useComparison(A_LEAGUE_ID, [1, 2])).result.current).toBe(comparison);
  expect(convex.compare).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, codes: [1, 2] });
});

test("with no codes it skips the query", () => {
  expect(renderHook(() => liveScouting.useComparison(A_LEAGUE_ID, null)).result.current).toBeUndefined();
  expect(convex.compare).toHaveBeenCalledWith("skip");
});
