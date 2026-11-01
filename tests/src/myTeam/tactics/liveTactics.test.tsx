// The Tactics seam's live wiring (#14), with Convex faked by name: what it asks the server, that a
// refusal comes back as the server's words, and that opening the tab is told to the server (#526).

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { beforeEach, expect, test, vi } from "vitest";
import { liveTactics } from "../../../../src/myTeam/tactics/liveTactics";
import { saveFailedWords } from "../../../../src/myTeam/tactics/words";
import { silenceConsoleError } from "../../../support/console.setup";
import { A_LEAGUE_ID } from "../../../support/src/convexReact.harness";

const convex = vi.hoisted(() => ({ ofMyTeam: vi.fn(), save: vi.fn(), openedTactics: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "lineup/tactics:ofMyTeam": convex.ofMyTeam },
    mutations: { "lineup/lineups:save": convex.save, "lineup/lineupDue:openedTactics": convex.openedTactics },
  }),
);

beforeEach(() => {
  convex.openedTactics.mockReset();
  convex.openedTactics.mockResolvedValue(null);
});

const NOW = Date.parse("2026-10-24T10:00:00Z");
const LINEUP = { starters: [{ playerCode: 1, area: "goalkeeper", lane: "centre" }] as const, bench: [2] };
const changes = () => renderHook(() => liveTactics.useLineupChanges()).result.current;

test("it asks lineup/tactics:ofMyTeam with the league and the minute, and hands on what comes back", () => {
  const tactics = { kind: "seasonOver" };
  convex.ofMyTeam.mockReturnValue(tactics);
  expect(renderHook(() => liveTactics.useTactics(A_LEAGUE_ID, NOW)).result.current).toBe(tactics);
  expect(convex.ofMyTeam).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, now: NOW });
});

test("a save asks lineup/lineups:save with the league and the lineup, and hands on the gameweek it saved from", async () => {
  convex.save.mockResolvedValue(9);
  expect(await changes().save(A_LEAGUE_ID, LINEUP)).toBe(9);
  expect(convex.save).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, lineup: { starters: [...LINEUP.starters], bench: LINEUP.bench } });
});

test("a refusal comes back as the server's words; any other failure is said plainly", async () => {
  convex.save.mockRejectedValue(new ConvexError("A lineup starts 11 players; this one starts 1."));
  expect(await changes().save(A_LEAGUE_ID, LINEUP)).toBe("A lineup starts 11 players; this one starts 1.");
  convex.save.mockRejectedValue(new Error("offline"));
  const logged = silenceConsoleError();
  expect(await changes().save(A_LEAGUE_ID, LINEUP)).toBe(saveFailedWords);
  expect(logged).toHaveBeenCalledOnce();
});

test("the tab open in a gameweek tells lineup/lineupDue:openedTactics once, again for the next, and not with none", () => {
  const { rerender } = renderHook(({ gameweek }) => liveTactics.useTacticsOpened(A_LEAGUE_ID, gameweek), { initialProps: { gameweek: null as number | null } });
  expect(convex.openedTactics).not.toHaveBeenCalled();
  rerender({ gameweek: 9 });
  rerender({ gameweek: 9 });
  expect(convex.openedTactics).toHaveBeenCalledOnce();
  expect(convex.openedTactics).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID });
  rerender({ gameweek: 10 });
  expect(convex.openedTactics).toHaveBeenCalledTimes(2);
});

test("telling the server the tab is open, when it fails, is logged", async () => {
  const failure = new Error("offline");
  convex.openedTactics.mockRejectedValue(failure);
  const logged = silenceConsoleError();
  renderHook(() => liveTactics.useTacticsOpened(A_LEAGUE_ID, 9));
  await vi.waitFor(() => expect(logged).toHaveBeenCalledWith("Telling the server Tactics was opened failed:", failure));
});
