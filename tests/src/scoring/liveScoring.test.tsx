// Player scoring's live wiring, with Convex's query and mutation faked by name: which server
// function each part reads or calls, with the minute the screen is at, and what a save resolves
// with when the server makes it, refuses it, or can't be reached.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { expect, test, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { useLiveScoring } from "../../../src/scoring/liveScoring";
import { saveFailedWords } from "../../../src/scoring/words";
import { silenceConsoleError } from "../../support/console.setup";
import { REVISION as revision } from "../../support/src/scoring.harness";

const convex = vi.hoisted(() => ({ view: vi.fn(), fix: vi.fn(), saveDraft: vi.fn(), announce: vi.fn(), withdraw: vi.fn(), runLab: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "scoring/siteScoring:view": convex.view },
    mutations: {
      "scoring/siteScoring:fix": convex.fix,
      "scoring/siteScoring:saveDraft": convex.saveDraft,
      "scoring/siteScoring:announce": convex.announce,
      "scoring/siteScoring:withdraw": convex.withdraw,
    },
    actions: { "balanceLab/balanceLabRun:run": convex.runLab },
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

test("saving a draft patch calls scoring/siteScoring:saveDraft with the version and the draft it was made over, and resolves with when it was saved (#368)", async () => {
  convex.saveDraft.mockResolvedValue(1_000);
  expect(await seam().saveDraft(scoring, revision, null)).toBe(1_000);
  expect(convex.saveDraft).toHaveBeenCalledExactlyOnceWith({ scoring, revision, draftSavedAt: null });
});

test("announcing calls scoring/siteScoring:announce with the draft and the moment, and resolves with the patch's name and gameweek", async () => {
  convex.announce.mockResolvedValue({ name: "26_27.1", fromGameweek: 10 });
  expect(await seam().announce(1_000, 2_000)).toEqual({ name: "26_27.1", fromGameweek: 10 });
  expect(convex.announce).toHaveBeenCalledExactlyOnceWith({ draftSavedAt: 1_000, takesEffectAt: 2_000 });
});

test("withdrawing calls scoring/siteScoring:withdraw, and a refusal comes back in the server's words", async () => {
  const versionId = "site-scoring-2" as Id<"siteScoring">;
  const refusal = "That patch isn't waiting to take effect, so it can't be withdrawn.";
  convex.withdraw.mockResolvedValueOnce(1_000);
  expect(await seam().withdraw(versionId)).toBeNull();
  expect(convex.withdraw).toHaveBeenCalledExactlyOnceWith({ versionId });

  convex.withdraw.mockRejectedValueOnce(new ConvexError(refusal));
  expect(await seam().withdraw(versionId)).toBe(refusal);
});

test("running the lab calls balanceLab/balanceLabRun:run with the draft, and a refusal comes back in the server's words (#843)", async () => {
  const report = { seasons: [2025], starts: 1, startsSkipped: 0, roles: [] };
  const refusal = "There's no draft patch to announce: save one first.";
  convex.runLab.mockResolvedValueOnce(report);
  expect(await seam().runLab(1_000)).toEqual(report);
  expect(convex.runLab).toHaveBeenCalledExactlyOnceWith({ draftSavedAt: 1_000 });

  convex.runLab.mockRejectedValueOnce(new ConvexError(refusal));
  expect(await seam().runLab(1_000)).toBe(refusal);
});
