// The Tactics seam's live wiring (#14), with Convex faked by name: what it asks the server, and
// that a refusal comes back as the server's words.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { afterEach, expect, test, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { liveTactics } from "../../../src/myTeam/liveTactics";
import { saveFailedWords } from "../../../src/myTeam/tacticsWords";
import { silenceConsoleError } from "../../support/console.setup";

const convex = vi.hoisted(() => ({ ofMyTeam: vi.fn(), save: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "lineup/tactics:ofMyTeam": convex.ofMyTeam },
    mutations: { "lineup/lineups:save": convex.save },
  }),
);

afterEach(() => {
  convex.ofMyTeam.mockReset();
  convex.save.mockReset();
});

const leagueId = "league-1" as Id<"leagues">;
const NOW = Date.parse("2026-10-24T10:00:00Z");
const LINEUP = { starters: [{ playerCode: 1, area: "goalkeeper", lane: "centre" }] as const, bench: [2] };
const changes = () => renderHook(() => liveTactics.useLineupChanges()).result.current;

test("it asks lineup/tactics:ofMyTeam with the league and the minute, and hands on what comes back", () => {
  const tactics = { kind: "seasonOver" };
  convex.ofMyTeam.mockReturnValue(tactics);
  expect(renderHook(() => liveTactics.useTactics(leagueId, NOW)).result.current).toBe(tactics);
  expect(convex.ofMyTeam).toHaveBeenCalledWith({ leagueId, now: NOW });
});

test("a save asks lineup/lineups:save with the league and the lineup, and hands on the gameweek it saved from", async () => {
  convex.save.mockResolvedValue(9);
  expect(await changes().save(leagueId, LINEUP)).toBe(9);
  expect(convex.save).toHaveBeenCalledWith({ leagueId, lineup: { starters: [...LINEUP.starters], bench: LINEUP.bench } });
});

test("a refusal comes back as the server's words; any other failure is said plainly", async () => {
  convex.save.mockRejectedValue(new ConvexError("A lineup starts 11 players; this one starts 1."));
  expect(await changes().save(leagueId, LINEUP)).toBe("A lineup starts 11 players; this one starts 1.");
  convex.save.mockRejectedValue(new Error("offline"));
  const logged = silenceConsoleError();
  expect(await changes().save(leagueId, LINEUP)).toBe(saveFailedWords);
  expect(logged).toHaveBeenCalledOnce();
});
