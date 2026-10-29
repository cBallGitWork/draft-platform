// The player card seam's live wiring, with Convex's query and mutation faked by name: where the card
// is read from and with what, what overriding a player's points asks and resolves with when the
// server takes it, refuses it, or can't be reached, and that the shortlist part is the shortlist's.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { expect, test, vi } from "vitest";
import { overrideRefusals } from "../../../convex/table/pointsOverrides";
import { livePlayerCard } from "../../../src/playerCard/livePlayerCard";
import type { PointsOverride } from "../../../src/playerCard/seam";
import { overrideFailedWords } from "../../../src/playerCard/words";
import { liveShortlist } from "../../../src/scouting/shortlist/liveShortlist";
import { silenceConsoleError } from "../../support/console.setup";
import { A_LEAGUE_ID } from "../../support/src/convexReact.harness";

const convex = vi.hoisted(() => ({ card: vi.fn(), override: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "playerCard/playerCard:card": convex.card },
    mutations: { "table/pointsOverrides:override": convex.override },
  }),
);

const PLAYER_CODE = 7;
const NOW = Date.parse("2026-10-25T12:00:00Z");
const CHANGE: PointsOverride = { fixtureCode: 101, playerCode: PLAYER_CODE, points: 4, reason: "Late own goal correction" };
const overrideOf = () => renderHook(() => livePlayerCard.useOverride()).result.current;

test("the card is read from playerCard/playerCard:card with the league, the player and the minute", () => {
  const card = { code: PLAYER_CODE };
  convex.card.mockReturnValue(card);
  expect(renderHook(() => livePlayerCard.usePlayerCard(A_LEAGUE_ID, PLAYER_CODE, NOW)).result.current).toBe(card);
  expect(convex.card).toHaveBeenLastCalledWith({ leagueId: A_LEAGUE_ID, playerCode: PLAYER_CODE, now: NOW });
});

test("overriding asks table/pointsOverrides:override with the league spread into the change, and resolves with no problem", async () => {
  convex.override.mockResolvedValue(null);
  expect(await overrideOf()(A_LEAGUE_ID, CHANGE)).toBeNull();
  expect(convex.override).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, ...CHANGE });
});

test("a refused override resolves with the server's own words", async () => {
  convex.override.mockRejectedValue(new ConvexError(overrideRefusals.notLocked));
  expect(await overrideOf()(A_LEAGUE_ID, CHANGE)).toBe(overrideRefusals.notLocked);
});

test("any other failure is logged and said plainly", async () => {
  const consoleError = silenceConsoleError();
  convex.override.mockRejectedValue(new Error("offline"));
  expect(await overrideOf()(A_LEAGUE_ID, CHANGE)).toBe(overrideFailedWords);
  expect(consoleError).toHaveBeenCalledWith("Overriding a player's points failed:", expect.any(Error));
});

test("the shortlist part is the live shortlist's own", () => {
  expect(livePlayerCard.useShortlist).toBe(liveShortlist.useShortlist);
  expect(livePlayerCard.useShortlistChanges).toBe(liveShortlist.useShortlistChanges);
});
