// The player card seam's live wiring, with Convex's query and mutation faked by name: where the card
// is read from and with what, what overriding a player's points asks and resolves with when the
// server takes it, refuses it, or can't be reached, and that the shortlist part is the shortlist's.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { expect, test, vi } from "vitest";
import { overrideRefusals } from "../../../convex/table/pointsOverrides";
import { livePlayerCard } from "../../../src/playerCard/livePlayerCard";
import type { PointsOverride } from "../../../src/playerCard/seam";
import { dropRefusals } from "../../../convex/waivers/waivers";
import { overrideFailedWords, waiverFailedWords } from "../../../src/playerCard/words";
import { liveShortlist } from "../../../src/scouting/shortlist/liveShortlist";
import { silenceConsoleError } from "../../support/console.setup";
import { A_LEAGUE_ID } from "../../support/src/convexReact.harness";

const convex = vi.hoisted(() => ({ card: vi.fn(), override: vi.fn(), action: vi.fn(), drop: vi.fn(), putIn: vi.fn(), pickUp: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "playerCard/playerCard:card": convex.card, "waivers/waivers:cardActionOn": convex.action },
    mutations: {
      "table/pointsOverrides:override": convex.override,
      "waivers/waivers:drop": convex.drop,
      "waivers/waiverClaims:putIn": convex.putIn,
      "waivers/freeAgents:pickUp": convex.pickUp,
    },
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
  convex.override.mockRejectedValue(new ConvexError(overrideRefusals.blankReason));
  expect(await overrideOf()(A_LEAGUE_ID, CHANGE)).toBe(overrideRefusals.blankReason);
});

test("any other failure is logged and said plainly", async () => {
  const consoleError = silenceConsoleError();
  convex.override.mockRejectedValue(new Error("offline"));
  expect(await overrideOf()(A_LEAGUE_ID, CHANGE)).toBe(overrideFailedWords);
  expect(consoleError).toHaveBeenCalledWith("Overriding a player's points failed:", expect.any(Error));
});

test("the waiver action is read from waivers/waivers:cardActionOn with the league and the player", () => {
  convex.action.mockReturnValue({ kind: "drop" });
  expect(renderHook(() => livePlayerCard.useCardAction(A_LEAGUE_ID, PLAYER_CODE)).result.current).toEqual({ kind: "drop" });
  expect(convex.action).toHaveBeenLastCalledWith({ leagueId: A_LEAGUE_ID, playerCode: PLAYER_CODE });
});

test("a drop, a claim and a pickup ask their own mutations, and a refusal comes back as the server's words", async () => {
  const changes = renderHook(() => livePlayerCard.useWaiverChanges()).result.current;
  convex.drop.mockResolvedValue(null);
  convex.putIn.mockResolvedValue("claim-id");
  convex.pickUp.mockRejectedValue(new ConvexError(dropRefusals.locked));

  expect(await changes.drop(A_LEAGUE_ID, PLAYER_CODE)).toBeNull();
  expect(convex.drop).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, playerCode: PLAYER_CODE });
  expect(await changes.claim(A_LEAGUE_ID, PLAYER_CODE, 8)).toBeNull();
  expect(convex.putIn).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, playerCode: PLAYER_CODE, dropCode: 8 });
  expect(await changes.pickUp(A_LEAGUE_ID, PLAYER_CODE, null)).toBe(dropRefusals.locked);
  expect(convex.pickUp).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, playerCode: PLAYER_CODE, dropCode: null });
});

test("any other waiver failure is logged and said plainly", async () => {
  const consoleError = silenceConsoleError();
  convex.drop.mockRejectedValue(new Error("offline"));
  expect(await renderHook(() => livePlayerCard.useWaiverChanges()).result.current.drop(A_LEAGUE_ID, PLAYER_CODE)).toBe(waiverFailedWords);
  expect(consoleError).toHaveBeenCalledWith("Dropping a player failed:", expect.any(Error));
});

test("the shortlist part is the live shortlist's own", () => {
  expect(livePlayerCard.useShortlist).toBe(liveShortlist.useShortlist);
  expect(livePlayerCard.useShortlistChanges).toBe(liveShortlist.useShortlistChanges);
});
