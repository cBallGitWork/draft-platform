// The patches' tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { PatchesSeam, VersionNotes, WaitingPatch } from "../../../src/patches/seam";

/** What the fake server holds: the patch whose banner shows, and the notes; `loading` keeps the
 *  notes on their way. No banner and no notes unless a test says. */
export type PatchesData = { banner?: WaitingPatch | null; notes?: readonly VersionNotes[]; loading?: boolean };

/** Dismissing succeeds, unless a test says otherwise. */
export function fakePatches({ banner = null, notes = [], loading = false }: PatchesData = {}) {
  return {
    useBanner: vi.fn<PatchesSeam["useBanner"]>(() => banner),
    dismiss: vi.fn<PatchesSeam["dismiss"]>(async () => null),
    useNotes: vi.fn<PatchesSeam["useNotes"]>(() => (loading ? undefined : notes)),
  };
}
