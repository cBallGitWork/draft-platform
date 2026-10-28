// The patches seam's live wiring, with Convex's queries and mutation faked by name: where the
// banner and the notes are read from, the banner at the screen's minute, and what dismissing asks
// and resolves with when the server dismisses it, refuses it, or can't be reached.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { expect, test, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { patchBannerRefusals } from "../../../convex/scoring/patchNotes";
import { useLivePatches } from "../../../src/patches/livePatches";
import { dismissFailedWords } from "../../../src/patches/words";
import { silenceConsoleError } from "../../support/console.setup";

const convex = vi.hoisted(() => ({ banner: vi.fn(), notes: vi.fn(), dismiss: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "scoring/patchNotes:banner": convex.banner, "scoring/patchNotes:notes": convex.notes },
    mutations: { "scoring/patchNotes:dismissBanner": convex.dismiss },
  }),
);

const VERSION = "version-1" as Id<"siteScoring">;
const seam = () => renderHook(() => useLivePatches()).result.current;

test("the banner is read from scoring/patchNotes:banner at the start of the current minute", () => {
  const minute = Date.parse("2026-10-25T12:00:00Z");
  vi.useFakeTimers({ now: minute + 30_000 });
  convex.banner.mockReturnValue(null);
  expect(renderHook(() => useLivePatches().useBanner()).result.current).toBeNull();
  expect(convex.banner).toHaveBeenLastCalledWith({ now: minute });
});

test("the notes are read from scoring/patchNotes:notes", () => {
  const notes: unknown[] = [];
  convex.notes.mockReturnValue(notes);
  expect(renderHook(() => useLivePatches().useNotes()).result.current).toBe(notes);
  expect(convex.notes).toHaveBeenLastCalledWith({});
});

test("dismissing asks scoring/patchNotes:dismissBanner for the version, and resolves with no problem", async () => {
  convex.dismiss.mockResolvedValue(null);
  expect(await seam().dismiss(VERSION)).toBeNull();
  expect(convex.dismiss).toHaveBeenCalledWith({ versionId: VERSION });
});

test("a refusal resolves with the server's own words", async () => {
  convex.dismiss.mockRejectedValue(new ConvexError(patchBannerRefusals.noPatch));
  expect(await seam().dismiss(VERSION)).toBe(patchBannerRefusals.noPatch);
});

test("any other failure is logged and said plainly", async () => {
  const consoleError = silenceConsoleError();
  convex.dismiss.mockRejectedValue(new Error("offline"));
  expect(await seam().dismiss(VERSION)).toBe(dismissFailedWords);
  expect(consoleError).toHaveBeenCalledWith("Dismissing the patch banner failed:", expect.any(Error));
});
