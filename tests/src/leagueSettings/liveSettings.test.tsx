// League settings' live wiring, with Convex's query and mutation faked by name: which server
// function each part reads or calls, with the minute the screen is at, and what a save resolves
// with when the server makes it, refuses it, or can't be reached.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { expect, test, vi } from "vitest";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { leagueSettingsOf, type LeagueSettings } from "../../../convex/rules/leagueSettingsPart";
import { useLiveLeagueSettings } from "../../../src/leagueSettings/liveSettings";
import { saveFailedWords, teamOrderFailedWords } from "../../../src/leagueSettings/words";
import type { Id } from "../../../convex/_generated/dataModel";
import { draftOrderRefusals } from "../../../convex/draft/draftOrder";
import { silenceConsoleError } from "../../support/console.setup";
import { REVISION as revision } from "../../support/src/leagueSettings.harness";
import { A_LEAGUE_ID } from "../../support/src/convexReact.harness";

const convex = vi.hoisted(() => ({ settings: vi.fn(), changeSettings: vi.fn(), teamOrder: vi.fn(), setTeamOrder: vi.fn(), drawTeamOrder: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "rules/leagueSettings:settings": convex.settings, "draft/draftOrder:teamOrder": convex.teamOrder },
    mutations: {
      "rules/leagueSettings:changeSettings": convex.changeSettings,
      "draft/draftOrder:setTeamOrder": convex.setTeamOrder,
      "draft/draftOrder:drawTeamOrder": convex.drawTeamOrder,
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
  const order = [{ teamId: "team-1", name: "Saka Potatoes" }];
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
