// The table seam's live wiring, with Convex's query faked: what it asks the server, and that it
// hands on what comes back as it comes.

import { renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { liveTable } from "./liveTable";
import { leagueTableOf } from "./drawnTable";

const convex = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: convex.query }));

afterEach(() => convex.query.mockReset());

const leagueId = "league-1" as Id<"leagues">;

test("it reads the league's table and fixtures from the server, as they come", () => {
  const table = leagueTableOf(["Team 1", "Team 2"]);
  convex.query.mockReturnValue(table);
  expect(renderHook(() => liveTable.useLeagueTable(leagueId)).result.current).toBe(table);
  expect(convex.query).toHaveBeenCalledWith(expect.anything(), { leagueId });
});

test("it is undefined while loading", () => {
  convex.query.mockReturnValue(undefined);
  expect(renderHook(() => liveTable.useLeagueTable(leagueId)).result.current).toBeUndefined();
});
