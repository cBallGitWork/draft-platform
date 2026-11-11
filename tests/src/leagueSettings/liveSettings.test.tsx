// League settings' live wiring, with Convex's query and mutation faked by name: which server
// function each part reads or calls, with the minute the screen is at, and what a save resolves
// with when the server makes it, refuses it, or can't be reached.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { expect, test, vi } from "vitest";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { leagueSettingsOf, type LeagueSettings } from "../../../convex/rules/leagueSettingsPart";
import { useLiveLeagueSettings } from "../../../src/leagueSettings/liveSettings";
import { draftStartFailedWords, saveFailedWords, scoringStartFailedWords, teamOrderFailedWords } from "../../../src/leagueSettings/words";
import { draftStartRefusals } from "../../../convex/draft/draftStart";
import { scoringStartRefusals } from "../../../convex/gameweeks/scoringStart";
import type { Id } from "../../../convex/_generated/dataModel";
import { draftOrderRefusals } from "../../../convex/draft/draftOrder";
import { silenceConsoleError } from "../../support/console.setup";
import { REVISION as revision } from "../../support/src/leagueSettings.harness";
import { A_LEAGUE_ID } from "../../support/src/convexReact.harness";

const convex = vi.hoisted(() => ({
  settings: vi.fn(),
  changeSettings: vi.fn(),
  teamOrder: vi.fn(),
  setTeamOrder: vi.fn(),
  drawTeamOrder: vi.fn(),
  scoringStart: vi.fn(),
  setScoringStart: vi.fn(),
  draft: vi.fn(),
  setStart: vi.fn(),
}));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "rules/leagueSettings:settings": convex.settings, "draft/draftOrder:teamOrder": convex.teamOrder, "gameweeks/scoringStart:ofLeague": convex.scoringStart, "draft/draftStart:ofLeague": convex.draft },
    mutations: {
      "rules/leagueSettings:changeSettings": convex.changeSettings,
      "draft/draftOrder:setTeamOrder": convex.setTeamOrder,
      "draft/draftOrder:drawTeamOrder": convex.drawTeamOrder,
      "gameweeks/scoringStart:setScoringStart": convex.setScoringStart,
      "draft/draftStart:setStart": convex.setStart,
    },
  }),
);

const settings: LeagueSettings = { ...leagueSettingsOf(FIRST_RULES), oddTeamOut: "bye", gamesPerGameweek: 2 };
const seam = () => renderHook(() => useLiveLeagueSettings()).result.current;

test("the settings are read from rules/leagueSettings:settings, at the start of the current minute", () => {
  vi.useFakeTimers({ now: Date.parse("2026-10-22T09:30:42Z") });
  const view = { part: settings, revision, changesFrom: 9 };
  convex.settings.mockReturnValue(view);

  expect(renderHook(() => useLiveLeagueSettings().useSettings(A_LEAGUE_ID)).result.current).toBe(view);
  expect(convex.settings).toHaveBeenLastCalledWith({ leagueId: A_LEAGUE_ID, now: Date.parse("2026-10-22T09:30:00Z") });
});

test("saving calls rules/leagueSettings:changeSettings with the rules row it was edited from, and resolves with the gameweek it applies from", async () => {
  convex.changeSettings.mockResolvedValue(9);
  expect(await seam().save(A_LEAGUE_ID, settings, revision)).toBe(9);
  expect(convex.changeSettings).toHaveBeenCalledExactlyOnceWith({ leagueId: A_LEAGUE_ID, settings, revision });
});

test("a save the server refuses resolves with the server's own words", async () => {
  const refusal = "The head-to-head games each team plays a gameweek must be a whole number, 1 or more, not 0.";
  convex.changeSettings.mockRejectedValue(new ConvexError(refusal));
  expect(await seam().save(A_LEAGUE_ID, settings, revision)).toBe(refusal);
});

test("any other failure is logged and said plainly", async () => {
  const failure = new Error("offline");
  convex.changeSettings.mockRejectedValue(failure);
  const logged = silenceConsoleError();

  expect(await seam().save(A_LEAGUE_ID, settings, revision)).toBe(saveFailedWords);
  expect(logged).toHaveBeenCalledWith("Saving the league settings failed:", failure);
});

test("the commissioner's draft order is read from draft/draftOrder:teamOrder", () => {
  const order = { teams: [{ teamId: "team-1", name: "Saka Potatoes" }], started: false };
  convex.teamOrder.mockReturnValue(order);

  expect(renderHook(() => useLiveLeagueSettings().useTeamOrder(A_LEAGUE_ID)).result.current).toBe(order);
  expect(convex.teamOrder).toHaveBeenLastCalledWith({ leagueId: A_LEAGUE_ID });
});

test("saving the draft order calls draft/draftOrder:setTeamOrder, and resolves with null, the server's refusal, or the failure said plainly", async () => {
  const teamIds = ["team-2", "team-1"] as Id<"teams">[];
  convex.setTeamOrder.mockResolvedValueOnce(null);
  expect(await seam().saveTeamOrder(A_LEAGUE_ID, teamIds)).toBeNull();
  expect(convex.setTeamOrder).toHaveBeenCalledExactlyOnceWith({ leagueId: A_LEAGUE_ID, teamIds });

  convex.setTeamOrder.mockRejectedValueOnce(new ConvexError(draftOrderRefusals.teamsChanged));
  expect(await seam().saveTeamOrder(A_LEAGUE_ID, teamIds)).toBe(draftOrderRefusals.teamsChanged);

  const failure = new Error("offline");
  convex.setTeamOrder.mockRejectedValueOnce(failure);
  const logged = silenceConsoleError();
  expect(await seam().saveTeamOrder(A_LEAGUE_ID, teamIds)).toBe(teamOrderFailedWords);
  expect(logged).toHaveBeenCalledWith("Saving the draft order failed:", failure);
});

test("drawing the draft order calls draft/draftOrder:drawTeamOrder, and resolves with null, the server's refusal, or the failure said plainly", async () => {
  convex.drawTeamOrder.mockResolvedValueOnce(null);
  expect(await seam().drawTeamOrder(A_LEAGUE_ID)).toBeNull();
  expect(convex.drawTeamOrder).toHaveBeenCalledExactlyOnceWith({ leagueId: A_LEAGUE_ID });

  convex.drawTeamOrder.mockRejectedValueOnce(new ConvexError(draftOrderRefusals.started));
  expect(await seam().drawTeamOrder(A_LEAGUE_ID)).toBe(draftOrderRefusals.started);

  const failure = new Error("offline");
  convex.drawTeamOrder.mockRejectedValueOnce(failure);
  const logged = silenceConsoleError();
  expect(await seam().drawTeamOrder(A_LEAGUE_ID)).toBe(teamOrderFailedWords);
  expect(logged).toHaveBeenCalledWith("Drawing the draft order failed:", failure);
});

test("the scoring start is read from gameweeks/scoringStart:ofLeague", () => {
  const view = { start: 8, ticked: [{ gameweek: 8, deadline: null }] };
  convex.scoringStart.mockReturnValue(view);

  expect(renderHook(() => useLiveLeagueSettings().useScoringStart(A_LEAGUE_ID)).result.current).toBe(view);
  expect(convex.scoringStart).toHaveBeenLastCalledWith({ leagueId: A_LEAGUE_ID });
});

test("setting the scoring start calls gameweeks/scoringStart:setScoringStart, and resolves with null, the server's refusal, or the failure said plainly", async () => {
  convex.setScoringStart.mockResolvedValueOnce(null);
  expect(await seam().setScoringStart(A_LEAGUE_ID, 8)).toBeNull();
  expect(convex.setScoringStart).toHaveBeenCalledExactlyOnceWith({ leagueId: A_LEAGUE_ID, gameweek: 8 });

  convex.setScoringStart.mockRejectedValueOnce(new ConvexError(scoringStartRefusals.begun(8)));
  expect(await seam().setScoringStart(A_LEAGUE_ID, 8)).toBe(scoringStartRefusals.begun(8));

  const failure = new Error("offline");
  convex.setScoringStart.mockRejectedValueOnce(failure);
  const logged = silenceConsoleError();
  expect(await seam().setScoringStart(A_LEAGUE_ID, 8)).toBe(scoringStartFailedWords);
  expect(logged).toHaveBeenCalledWith("Setting the scoring start failed:", failure);
});

test("the draft's start is read from draft/draftStart:ofLeague: a waiting draft's date, and any other as started", () => {
  vi.useFakeTimers({ now: Date.parse("2026-10-22T09:30:42Z") });
  const startsAt = Date.parse("2026-11-15T19:00:00Z");
  convex.draft.mockReturnValue({ status: "waiting", startsAt, rounds: 15, order: [] });
  expect(renderHook(() => useLiveLeagueSettings().useDraftStart(A_LEAGUE_ID)).result.current).toEqual({ startsAt, started: false });
  expect(convex.draft).toHaveBeenLastCalledWith({ leagueId: A_LEAGUE_ID, now: Date.parse("2026-10-22T09:30:00Z") });

  convex.draft.mockReturnValue({ status: "over", startedAt: startsAt, rounds: 15, order: [], picksMade: 120 });
  expect(renderHook(() => useLiveLeagueSettings().useDraftStart(A_LEAGUE_ID)).result.current).toEqual({ startsAt: null, started: true });

  convex.draft.mockReturnValue(undefined);
  expect(renderHook(() => useLiveLeagueSettings().useDraftStart(A_LEAGUE_ID)).result.current).toBeUndefined();
});

test("setting the draft's start calls draft/draftStart:setStart, and resolves with null, the server's refusal, or the failure said plainly", async () => {
  const startsAt = Date.parse("2026-11-15T19:00:00Z");
  convex.setStart.mockResolvedValueOnce(null);
  expect(await seam().setDraftStart(A_LEAGUE_ID, startsAt)).toBeNull();
  expect(convex.setStart).toHaveBeenCalledExactlyOnceWith({ leagueId: A_LEAGUE_ID, startsAt });

  convex.setStart.mockResolvedValueOnce(null);
  expect(await seam().setDraftStart(A_LEAGUE_ID, null)).toBeNull();
  expect(convex.setStart).toHaveBeenLastCalledWith({ leagueId: A_LEAGUE_ID, startsAt: null });

  convex.setStart.mockRejectedValueOnce(new ConvexError(draftStartRefusals.notAhead));
  expect(await seam().setDraftStart(A_LEAGUE_ID, startsAt)).toBe(draftStartRefusals.notAhead);

  const failure = new Error("offline");
  convex.setStart.mockRejectedValueOnce(failure);
  const logged = silenceConsoleError();
  expect(await seam().setDraftStart(A_LEAGUE_ID, startsAt)).toBe(draftStartFailedWords);
  expect(logged).toHaveBeenCalledWith("Setting the draft's start failed:", failure);
});
