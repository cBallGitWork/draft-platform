// Player scoring's live wiring, with Convex's query and mutation faked by name: which server
// function each part reads or calls, with the minute the screen is at, and what a save resolves
// with when the server makes it, refuses it, or can't be reached.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { expect, test, vi } from "vitest";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { useLiveScoring } from "../../../src/scoring/liveScoring";
import { saveFailedWords } from "../../../src/scoring/words";
import { silenceConsoleError } from "../../support/console.setup";
import { REVISION as revision } from "../../support/src/scoring.harness";

const convex = vi.hoisted(() => ({ view: vi.fn(), fix: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "scoring/siteScoring:view": convex.view },
    mutations: { "scoring/siteScoring:fix": convex.fix },
  }),
);

const scoring = FIRST_SCORING;
const seam = () => renderHook(() => useLiveScoring()).result.current;

test("the site's scoring is read from scoring/siteScoring:view, at the start of the current minute", () => {
  vi.useFakeTimers({ now: Date.parse("2026-10-22T09:30:42Z") });
  const view = { part: scoring, revision, changesFrom: 9, canEdit: false };
  convex.view.mockReturnValue(view);

  expect(renderHook(() => useLiveScoring().useScoring()).result.current).toBe(view);
  expect(convex.view).toHaveBeenLastCalledWith({ now: Date.parse("2026-10-22T09:30:00Z") });
});

test("saving calls scoring/siteScoring:fix with the version it was edited from, and resolves with the gameweek it applies from", async () => {
  convex.fix.mockResolvedValue(9);
  expect(await seam().save(scoring, revision)).toBe(9);
  expect(convex.fix).toHaveBeenCalledExactlyOnceWith({ scoring, revision });
});

test("a save the server refuses resolves with the server's own words", async () => {
  const refusal = "The scoring set can't be saved: the Assists rule is worth 0.25; points are kept in tenths.";
  convex.fix.mockRejectedValue(new ConvexError(refusal));
  expect(await seam().save(scoring, revision)).toBe(refusal);
});

test("any other failure is logged and said plainly", async () => {
  const failure = new Error("offline");
  convex.fix.mockRejectedValue(failure);
  const logged = silenceConsoleError();

  expect(await seam().save(scoring, revision)).toBe(saveFailedWords);
  expect(logged).toHaveBeenCalledWith("Saving the scoring failed:", failure);
});
