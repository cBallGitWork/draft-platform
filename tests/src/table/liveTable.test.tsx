// The table seam's live wiring, with Convex's query faked by name: what it asks the server, and that it
// hands on what comes back as it comes.

import { renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { liveTable } from "../../../src/table/liveTable";
import { leagueTableOf } from "../../../src/table/drawnTable";

const convex = vi.hoisted(() => ({ ofLeague: vi.fn() }));
vi.mock("convex/react", async () => (await import("../../support/src/convexReact.harness")).fakeConvexReact({ queries: { "table/leagueTable:ofLeague": convex.ofLeague } }));

afterEach(() => convex.ofLeague.mockReset());

const leagueId = "league-1" as Id<"leagues">;

test("it reads the league's table and fixtures from table/leagueTable:ofLeague, as they come", () => {
  const table = leagueTableOf(["Team 1", "Team 2"]);
  convex.ofLeague.mockReturnValue(table);
  expect(renderHook(() => liveTable.useLeagueTable(leagueId)).result.current).toBe(table);
  expect(convex.ofLeague).toHaveBeenCalledWith({ leagueId });
});

test("it is undefined while loading", () => {
  convex.ofLeague.mockReturnValue(undefined);
  expect(renderHook(() => liveTable.useLeagueTable(leagueId)).result.current).toBeUndefined();
});
