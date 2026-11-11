// The Scouting seam's live wiring, with Convex's query faked by name: what it asks the server, and
// that it hands on what comes back as it comes, the players list filtered and sorted here (#1552).

import { renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { PlayersFilters, PlayersSort } from "../../../convex/scouting/playersList";
import { liveScouting } from "../../../src/scouting/liveScouting";
import { A_LEAGUE_ID } from "../../support/src/convexReact.harness";
import { PALMER, RICE, SAKA } from "../../support/src/scoutingScreen.harness";

const convex = vi.hoisted(() => ({ list: vi.fn(), compare: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "scouting/playersList:list": convex.list, "scouting/compare:players": convex.compare },
  }),
);

const filters: PlayersFilters = { availability: "freeAgents", position: "CB", clubCode: 3 };
const sort: PlayersSort = { by: "club", descending: true };

const stat = "goals_scored";

test("it asks scouting/playersList:list with the league, the club and the shown stat, and hands on what comes back", () => {
  const list = { clubs: [], players: [] };
  convex.list.mockReturnValue(list);
  expect(renderHook(() => liveScouting.usePlayersList(A_LEAGUE_ID, filters, sort, stat)).result.current).toEqual(list);
  expect(convex.list).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, clubCode: 3, stat });
});

test("it is undefined while loading", () => {
  convex.list.mockReturnValue(undefined);
  expect(renderHook(() => liveScouting.usePlayersList(A_LEAGUE_ID, filters, sort, null)).result.current).toBeUndefined();
});

test("it keeps the players the filters keep, in the sort's order, and a new sort or filter asks the server the same", () => {
  convex.list.mockClear().mockReturnValue({ clubs: [], players: [SAKA, RICE, PALMER] });
  const ask = { leagueId: A_LEAGUE_ID, clubCode: null, stat: null };
  const { result, rerender } = renderHook(({ filters, sort }: { filters: PlayersFilters; sort: PlayersSort }) => liveScouting.usePlayersList(A_LEAGUE_ID, filters, sort, null), {
    initialProps: { filters: { availability: "all", position: null, clubCode: null }, sort: { by: "name", descending: false } },
  });
  expect(result.current!.players.map(({ name }) => name)).toEqual(["Palmer", "Rice", "Saka"]);
  rerender({ filters: { availability: "owned", position: null, clubCode: null }, sort: { by: "club", descending: true } });
  expect(result.current!.players.map(({ name }) => name)).toEqual(["Palmer", "Saka"]);
  for (const [asked] of convex.list.mock.calls) expect(asked).toEqual(ask);
});

test("it asks scouting/compare:players for the two codes, and hands on what comes back", () => {
  const comparison = [{ code: 1 }, { code: 2 }];
  convex.compare.mockReturnValue(comparison);
  expect(renderHook(() => liveScouting.useComparison(A_LEAGUE_ID, [1, 2], stat, "last6")).result.current).toBe(comparison);
  expect(convex.compare).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, codes: [1, 2], stat, period: "last6" });
});

test("with no codes it skips the query", () => {
  expect(renderHook(() => liveScouting.useComparison(A_LEAGUE_ID, null, null, "season")).result.current).toBeUndefined();
  expect(convex.compare).toHaveBeenCalledWith("skip");
});
