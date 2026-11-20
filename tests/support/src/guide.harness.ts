// The Guide's tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { GuideSeam, GuideSection } from "../../../src/guide/seam";

/** What the fake server holds: the Guide, and whether it is still on its way. */
export type GuideData = { guide?: readonly GuideSection[]; loading?: boolean };

/** Every change succeeds, unless a test says otherwise; `loading` keeps the Guide undefined. */
export function fakeGuide({ guide = [], loading = false }: GuideData = {}) {
  return {
    useGuide: vi.fn<GuideSeam["useGuide"]>(() => (loading ? undefined : guide)),
    addSection: vi.fn<GuideSeam["addSection"]>(async () => null),
    removeSection: vi.fn<GuideSeam["removeSection"]>(async () => null),
    moveSection: vi.fn<GuideSeam["moveSection"]>(async () => null),
    addEntry: vi.fn<GuideSeam["addEntry"]>(async () => null),
    editEntry: vi.fn<GuideSeam["editEntry"]>(async () => null),
    removeEntry: vi.fn<GuideSeam["removeEntry"]>(async () => null),
    moveEntry: vi.fn<GuideSeam["moveEntry"]>(async () => null),
    editFormationEntry: vi.fn<GuideSeam["editFormationEntry"]>(async () => null),
    moveFormationEntry: vi.fn<GuideSeam["moveFormationEntry"]>(async () => null),
  };
}
