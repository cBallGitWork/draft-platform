// The Scouting seam's live wiring, with Convex's query faked by name: what it asks the server, and
// that it hands on what comes back as it comes.

import { renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { PlayersFilters, PlayersSort } from "../../../convex/scouting/playersList";
import { liveScouting } from "../../../src/scouting/liveScouting";

const convex = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "scouting/playersList:list": convex.list },
  }),
);

afterEach(() => convex.list.mockReset());

const leagueId = "league-1" as Id<"leagues">;
const filters: PlayersFilters = { availability: "freeAgents", position: "CB", clubCode: 3 };
const sort: PlayersSort = { by: "club", descending: true };

test("it asks scouting/playersList:list with the league, the filters and the sort, and hands on what comes back", () => {
  const list = { clubs: [], players: [] };
  convex.list.mockReturnValue(list);
  expect(renderHook(() => liveScouting.usePlayersList(leagueId, filters, sort)).result.current).toBe(list);
  expect(convex.list).toHaveBeenCalledWith({ leagueId, filters, sort });
});

test("it is undefined while loading", () => {
  convex.list.mockReturnValue(undefined);
  expect(renderHook(() => liveScouting.usePlayersList(leagueId, filters, sort)).result.current).toBeUndefined();
});
