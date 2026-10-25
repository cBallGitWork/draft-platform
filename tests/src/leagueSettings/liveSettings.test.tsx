// League settings' live wiring, with Convex's query and mutation faked by name: which server
// function each part reads or calls, with the minute the screen is at, and what a save resolves
// with when the server makes it, refuses it, or can't be reached.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { afterEach, expect, test, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { leagueSettingsOf, type LeagueSettings } from "../../../convex/rules/leagueSettingsPart";
import { useLiveLeagueSettings } from "../../../src/leagueSettings/liveSettings";
import { saveFailedWords } from "../../../src/leagueSettings/words";
import { silenceConsoleError } from "../../support/console.setup";
import { REVISION as revision } from "../../support/src/leagueSettings.harness";

const convex = vi.hoisted(() => ({ settings: vi.fn(), changeSettings: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "rules/leagueSettings:settings": convex.settings },
    mutations: { "rules/leagueSettings:changeSettings": convex.changeSettings },
  }),
);

afterEach(() => {
  vi.useRealTimers();
  for (const fake of Object.values(convex)) fake.mockReset();
});

const leagueId = "league-1" as Id<"leagues">;
const settings: LeagueSettings = { ...leagueSettingsOf(FIRST_RULES), oddTeamOut: "bye", gamesPerGameweek: 2 };
const seam = () => renderHook(() => useLiveLeagueSettings()).result.current;

test("the settings are read from rules/leagueSettings:settings, at the start of the current minute", () => {
  vi.useFakeTimers({ now: Date.parse("2026-10-22T09:30:42Z") });
  const view = { part: settings, revision, changesFrom: 9 };
  convex.settings.mockReturnValue(view);

  expect(renderHook(() => useLiveLeagueSettings().useSettings(leagueId)).result.current).toBe(view);
  expect(convex.settings).toHaveBeenLastCalledWith({ leagueId, now: Date.parse("2026-10-22T09:30:00Z") });
});

test("saving calls rules/leagueSettings:changeSettings with the rules row it was edited from, and resolves with the gameweek it applies from", async () => {
  convex.changeSettings.mockResolvedValue(9);
  expect(await seam().save(leagueId, settings, revision)).toBe(9);
  expect(convex.changeSettings).toHaveBeenCalledExactlyOnceWith({ leagueId, settings, revision });
});

test("a save the server refuses resolves with the server's own words", async () => {
  const refusal = "The head-to-head games each team plays a gameweek must be a whole number, 1 or more, not 0.";
  convex.changeSettings.mockRejectedValue(new ConvexError(refusal));
  expect(await seam().save(leagueId, settings, revision)).toBe(refusal);
});

test("any other failure is logged and said plainly", async () => {
  const failure = new Error("offline");
  convex.changeSettings.mockRejectedValue(failure);
  const logged = silenceConsoleError();

  expect(await seam().save(leagueId, settings, revision)).toBe(saveFailedWords);
  expect(logged).toHaveBeenCalledWith("Saving the league settings failed:", failure);
});
