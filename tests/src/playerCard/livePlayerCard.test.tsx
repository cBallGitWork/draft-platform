// The player card seam's live wiring, with Convex's query and mutation faked by name: where the card
// is read from and with what, what overriding a player's points asks and resolves with when the
// server takes it, refuses it, or can't be reached, and that the shortlist part is the shortlist's.

import { renderHook } from "@testing-library/react";
import type { Id } from "../../../convex/_generated/dataModel";
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
import { GAMEWEEK_12_CLOCK, THURSDAYS_RUN, WEDNESDAY_NOON } from "../../support/src/waiverClock.harness";

const convex = vi.hoisted(() => ({ card: vi.fn(), rank: vi.fn(), override: vi.fn(), removeOverride: vi.fn(), action: vi.fn(), clock: vi.fn(), drop: vi.fn(), putIn: vi.fn(), withdraw: vi.fn(), pickUp: vi.fn(), state: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: {
      "playerCard/playerCard:card": convex.card,
      "playerCard/positionRank:atPosition": convex.rank,
      "waivers/waivers:cardActionOn": convex.action,
      "waivers/waivers:stateOf": convex.state,
      "waivers/waiverClock:clockOf": convex.clock,
    },
    mutations: {
      "table/pointsOverrides:override": convex.override,
      "table/pointsOverrides:removeOverride": convex.removeOverride,
      "waivers/waivers:drop": convex.drop,
      "waivers/waiverClaims:putIn": convex.putIn,
      "waivers/waiverClaims:withdraw": convex.withdraw,
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

test("removing an override asks table/pointsOverrides:removeOverride with the league and the match, and a refusal comes back in the server's words", async () => {
  const removeOf = () => renderHook(() => livePlayerCard.useRemoveOverride()).result.current;
  const match = { fixtureCode: CHANGE.fixtureCode, playerCode: PLAYER_CODE };
  convex.removeOverride.mockResolvedValue(null);
  expect(await removeOf()(A_LEAGUE_ID, match)).toBeNull();
  expect(convex.removeOverride).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, ...match });

  convex.removeOverride.mockRejectedValue(new ConvexError(overrideRefusals.noOverride("Saka")));
  expect(await removeOf()(A_LEAGUE_ID, match)).toBe(overrideRefusals.noOverride("Saka"));
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

test("the waiver action is read from waivers/waivers:cardActionOn with the league and the player, no minute", () => {
  convex.action.mockReturnValue({ kind: "drop" });
  expect(renderHook(() => livePlayerCard.useCardAction(A_LEAGUE_ID, PLAYER_CODE)).result.current).toEqual({ kind: "drop" });
  expect(convex.action).toHaveBeenLastCalledWith({ leagueId: A_LEAGUE_ID, playerCode: PLAYER_CODE });
});

test("a claim on the card says the run that can first take him, judged at the minute from the hour's waiver clock, and waits for the clock to load (S08.14)", () => {
  vi.useFakeTimers({ now: WEDNESDAY_NOON });
  convex.action.mockReturnValue({ kind: "claim", claimableFrom: 0, squad: [], order: "reverseStandings", won: null });
  convex.clock.mockReturnValue(undefined);
  expect(renderHook(() => livePlayerCard.useCardAction(A_LEAGUE_ID, PLAYER_CODE)).result.current).toBeUndefined();
  convex.clock.mockReturnValue(GAMEWEEK_12_CLOCK);
  expect(renderHook(() => livePlayerCard.useCardAction(A_LEAGUE_ID, PLAYER_CODE)).result.current).toEqual({
    kind: "claim",
    firstRun: THURSDAYS_RUN,
    squad: [],
    order: "reverseStandings",
    wonBid: false,
  });
  expect(convex.clock).toHaveBeenLastCalledWith({ leagueId: A_LEAGUE_ID, hour: WEDNESDAY_NOON });
  vi.useRealTimers();
});

// At Wednesday noon no gameweek has ended yet, so a win with none ended still holds his team at the
// back, and one from after gameweek 11 ended is from a gameweek since reset; under rotating a win
// holds it for good.
test.each([
  { order: "reverseStandings", won: { gameweek: null }, wonBid: true },
  { order: "reverseStandings", won: { gameweek: 11 }, wonBid: false },
  { order: "rotating", won: { gameweek: 11 }, wonBid: true },
] as const)("S08.32: under $order, a bid won with $won.gameweek the latest gameweek ended holds his team at the back: $wonBid", ({ order, won, wonBid }) => {
  vi.useFakeTimers({ now: WEDNESDAY_NOON });
  convex.action.mockReturnValue({ kind: "claim", claimableFrom: 0, squad: [], order, won });
  convex.clock.mockReturnValue(GAMEWEEK_12_CLOCK);
  expect(renderHook(() => livePlayerCard.useCardAction(A_LEAGUE_ID, PLAYER_CODE)).result.current).toMatchObject({ order, wonBid });
  vi.useRealTimers();
});

test("S08.32: Withdraw beside a bid put in asks waivers/waiverClaims:withdraw with its claim's id", async () => {
  const changes = renderHook(() => livePlayerCard.useWaiverChanges()).result.current;
  convex.withdraw.mockResolvedValue(null);
  expect(await changes.withdraw(A_LEAGUE_ID, "claim-1" as Id<"waiverClaims">)).toBeNull();
  expect(convex.withdraw).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, claimId: "claim-1" });
});

test("the card head's released line reads waivers/waivers:stateOf: nothing while loading, null when owned or a free agent, and the run that can first take him once the clock loads (S12.2)", () => {
  vi.useFakeTimers({ now: WEDNESDAY_NOON });
  const releasedOf = () => renderHook(() => livePlayerCard.useReleased(A_LEAGUE_ID, PLAYER_CODE)).result.current;
  convex.clock.mockReturnValue(GAMEWEEK_12_CLOCK);
  convex.state.mockReturnValue(undefined);
  expect(releasedOf()).toBeUndefined();
  expect(convex.state).toHaveBeenLastCalledWith({ leagueId: A_LEAGUE_ID, playerCode: PLAYER_CODE });
  convex.state.mockReturnValue({ kind: "owned", teamId: "t1", teamName: "Gunners" });
  expect(releasedOf()).toBeNull();
  convex.state.mockReturnValue({ kind: "freeAgent" });
  expect(releasedOf()).toBeNull();
  convex.state.mockReturnValue({ kind: "onWaivers", claimableFrom: 0 });
  expect(releasedOf()).toEqual({ firstRun: THURSDAYS_RUN });
  convex.clock.mockReturnValue(undefined);
  expect(releasedOf()).toBeUndefined();
  vi.useRealTimers();
});

test("his rank is read from playerCard/positionRank:atPosition at the position asked, and skipped with none", () => {
  convex.rank.mockReturnValue({ place: 4, of: 38 });
  expect(renderHook(() => livePlayerCard.usePositionRank(A_LEAGUE_ID, PLAYER_CODE, "CAM")).result.current).toEqual({ place: 4, of: 38 });
  expect(convex.rank).toHaveBeenLastCalledWith({ leagueId: A_LEAGUE_ID, playerCode: PLAYER_CODE, position: "CAM" });
  renderHook(() => livePlayerCard.usePositionRank(A_LEAGUE_ID, PLAYER_CODE, null));
  expect(convex.rank).toHaveBeenLastCalledWith("skip");
});

test("a drop, a claim and a pickup ask their own mutations, and a refusal comes back as the server's words", async () => {
  const changes = renderHook(() => livePlayerCard.useWaiverChanges()).result.current;
  convex.drop.mockResolvedValue(null);
  convex.putIn.mockResolvedValue("claim-id");
  convex.pickUp.mockRejectedValue(new ConvexError(dropRefusals.locked));

  expect(await changes.drop(A_LEAGUE_ID, PLAYER_CODE)).toBeNull();
  expect(convex.drop).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, playerCode: PLAYER_CODE });
  expect(await changes.claim(A_LEAGUE_ID, PLAYER_CODE, 8)).toEqual({ claimId: "claim-id" });
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
