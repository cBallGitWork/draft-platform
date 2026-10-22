// The rules editor's live wiring, with Convex's query and mutation faked by name: which server
// function each part reads or calls, with the minute the screen is at, and what a save resolves
// with when the server makes it, refuses it, or can't be reached.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { afterEach, expect, test, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { useLiveScoring } from "../../../src/scoring/liveScoring";
import { saveFailedWords } from "../../../src/scoring/words";
import { silenceConsoleError } from "../../support/console.setup";
import { REVISION as revision } from "../../support/src/scoring.harness";

const convex = vi.hoisted(() => ({ scoring: vi.fn(), changeScoring: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "rules/leagueRules:scoring": convex.scoring },
    mutations: { "rules/leagueRules:changeScoring": convex.changeScoring },
  }),
);

afterEach(() => {
  vi.useRealTimers();
  for (const fake of Object.values(convex)) fake.mockReset();
});

const leagueId = "league-1" as Id<"leagues">;
const scoring = FIRST_RULES.scoring;
const seam = () => renderHook(() => useLiveScoring()).result.current;

test("the scoring is read from rules/leagueRules:scoring, at the start of the current minute", () => {
  vi.useFakeTimers({ now: Date.parse("2026-10-22T09:30:42Z") });
  const view = { part: scoring, revision, changesFrom: 9 };
  convex.scoring.mockReturnValue(view);

  expect(renderHook(() => useLiveScoring().useScoring(leagueId)).result.current).toBe(view);
  expect(convex.scoring).toHaveBeenLastCalledWith({ leagueId, now: Date.parse("2026-10-22T09:30:00Z") });
});

test("saving calls rules/leagueRules:changeScoring with the rules row it was edited from, and resolves with the gameweek it applies from", async () => {
  convex.changeScoring.mockResolvedValue(9);
  expect(await seam().save(leagueId, scoring, revision)).toBe(9);
  expect(convex.changeScoring).toHaveBeenCalledExactlyOnceWith({ leagueId, scoring, revision });
});

test("a save the server refuses resolves with the server's own words", async () => {
  const refusal = "The scoring set can't be saved: the Assists rule pays 0.25; points are kept in tenths.";
  convex.changeScoring.mockRejectedValue(new ConvexError(refusal));
  expect(await seam().save(leagueId, scoring, revision)).toBe(refusal);
});

test("any other failure is logged and said plainly", async () => {
  const failure = new Error("offline");
  convex.changeScoring.mockRejectedValue(failure);
  const logged = silenceConsoleError();

  expect(await seam().save(leagueId, scoring, revision)).toBe(saveFailedWords);
  expect(logged).toHaveBeenCalledWith("Saving the scoring failed:", failure);
});
