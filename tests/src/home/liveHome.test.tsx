// The league home seam's live wiring, with Convex's query faked by name: what it asks the server,
// and that it hands on what comes back as it comes.

import { renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { liveHome } from "../../../src/home/liveHome";
import { gameweekOneRecap, quietHome, quietNews } from "../../support/src/home.harness";
import { A_LEAGUE_ID } from "../../support/src/convexReact.harness";

const convex = vi.hoisted(() => ({ clockOf: vi.fn(), ofLeague: vi.fn(), matchdayOf: vi.fn(), ofGameweek: vi.fn(), news: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: {
      "home/homeClock:clockOf": convex.clockOf,
      "home/leagueHome:ofLeague": convex.ofLeague,
      "home/leagueHome:matchdayOf": convex.matchdayOf,
      "home/recaps:ofGameweek": convex.ofGameweek,
      "home/leagueNews:ofLeague": convex.news,
    },
  }),
);

test("its recap asks home/recaps:ofGameweek with the league and the gameweek, and hands on what comes back", () => {
  convex.ofGameweek.mockReturnValue(gameweekOneRecap);
  expect(renderHook(() => liveHome.useRecap(A_LEAGUE_ID, 1)).result.current).toBe(gameweekOneRecap);
  expect(convex.ofGameweek).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, gameweek: 1 });
});

const now = 1_000_000;
const { matchday: _matchday, recap: _recap, ...quietRead } = quietHome;
const heldHome = { ...quietRead, recap: null };

// Only the small clock query takes the minute (#1550): the rest take what it says, so a new minute
// asks them nothing new.
test("only home/homeClock:clockOf takes the minute; home/leagueHome:ofLeague takes the gameweek it says, and the home comes back as read", () => {
  convex.clockOf.mockReturnValue({ gameweek: 1, matchday: null });
  convex.ofLeague.mockReturnValue(heldHome);
  const { result, rerender } = renderHook(({ minute }) => liveHome.useLeagueHome(A_LEAGUE_ID, minute), { initialProps: { minute: now } });
  expect(result.current).toEqual(quietHome);
  expect(convex.clockOf).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, now });
  expect(convex.ofLeague).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, gameweek: 1 });
  expect(convex.matchdayOf).toHaveBeenCalledWith("skip");

  rerender({ minute: now + 60_000 });
  expect(convex.clockOf).toHaveBeenLastCalledWith({ leagueId: A_LEAGUE_ID, now: now + 60_000 });
  expect(convex.ofLeague).toHaveBeenLastCalledWith({ leagueId: A_LEAGUE_ID, gameweek: 1 });
});

test("while a matchday is open it asks home/leagueHome:matchdayOf for its matches, and says the Vidiprinter delayed from the moment it sends", () => {
  convex.clockOf.mockReturnValue({ gameweek: 1, matchday: { gameweek: 1, fixtureCodes: [7, 9] } });
  convex.ofLeague.mockReturnValue(heldHome);
  convex.matchdayOf.mockReturnValue({ kind: "read", lines: [], delayedFrom: now + 1 });
  const { result, rerender } = renderHook(({ minute }) => liveHome.useLeagueHome(A_LEAGUE_ID, minute), { initialProps: { minute: now } });
  expect(convex.matchdayOf).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, gameweek: 1, fixtureCodes: [7, 9] });
  expect(result.current?.matchday).toEqual({ gameweek: 1, commentary: { kind: "read", lines: [], delayed: false } });
  rerender({ minute: now + 1 });
  expect(result.current?.matchday).toEqual({ gameweek: 1, commentary: { kind: "read", lines: [], delayed: true } });
});

test("the recap leaves at the moment ofLeague sends with it", () => {
  convex.clockOf.mockReturnValue({ gameweek: 1, matchday: null });
  convex.ofLeague.mockReturnValue({ ...heldHome, recap: { ...gameweekOneRecap, until: now + 1 } });
  const { result, rerender } = renderHook(({ minute }) => liveHome.useLeagueHome(A_LEAGUE_ID, minute), { initialProps: { minute: now } });
  expect(result.current?.recap).toEqual(gameweekOneRecap);
  rerender({ minute: now + 1 });
  expect(result.current?.recap).toBeNull();
});

test("its News asks home/leagueNews:ofLeague with the league, the page and the filters, and hands on what comes back", () => {
  const asked = { before: { at: 2, filed: 1 }, teamId: null, kind: "playerDropped" as const };
  convex.news.mockReturnValue(quietNews);
  expect(renderHook(() => liveHome.useLeagueNews(A_LEAGUE_ID, asked)).result.current).toBe(quietNews);
  expect(convex.news).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, ...asked });
});

test("it is undefined while loading", () => {
  convex.clockOf.mockReturnValue(undefined);
  convex.ofLeague.mockReturnValue(undefined);
  expect(renderHook(() => liveHome.useLeagueHome(A_LEAGUE_ID, now)).result.current).toBeUndefined();
  expect(convex.ofLeague).toHaveBeenCalledWith("skip");
});
