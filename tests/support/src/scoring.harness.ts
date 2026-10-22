// The rules editor's tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import type { Revision, ScoringSeam, ScoringView } from "../../../src/scoring/seam";

/** The gameweek the fake server says a change takes effect from. */
export const CHANGES_FROM = 9;
/** The rules row the fake server's set is from. */
export const REVISION = "rules-1" as Revision;

/** What the fake server holds: the scoring set as `view` says, the first rules' by default; null
 *  for a league with no rules; `loading` keeps it on its way (undefined). */
export type ScoringData = { view?: ScoringView | null; loading?: boolean };

/** Saving succeeds from CHANGES_FROM, unless a test says otherwise. */
export function fakeScoring({ view = { scoring: structuredClone(FIRST_RULES.scoring), revision: REVISION, changesFrom: CHANGES_FROM }, loading = false }: ScoringData = {}) {
  return {
    useScoring: vi.fn<ScoringSeam["useScoring"]>(() => (loading ? undefined : view)),
    save: vi.fn<ScoringSeam["save"]>(async () => CHANGES_FROM),
  };
}
