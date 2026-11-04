// Player scoring's tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import type { ScoringSeam, ScoringView, SiteRevision } from "../../../src/scoring/seam";
import type { Rule } from "../../../src/scoring/editing";

/** A band rule priced by area with a limit for all: FPL's defensive contribution as the first set
 *  scored it until Craig dropped it (4 Nov 2026), kept as the editor's example of a band rule with
 *  a limit, which the first set no longer holds. */
export const LIMITED_BANDS: Rule = {
  shape: "bands",
  stat: "defensive_contribution",
  stack: false,
  values: {
    byArea: {
      goalkeeper: [],
      defence: [{ atLeast: 10, points: 2 }],
      defensiveMidfield: [{ atLeast: 12, points: 2 }],
      midfield: [{ atLeast: 12, points: 2 }],
      attackingMidfield: [{ atLeast: 12, points: 2 }],
      attack: [{ atLeast: 12, points: 2 }],
    },
  },
  limit: { all: { max: 2, min: null } },
};

/** The gameweek the fake server says a change takes effect from. */
export const CHANGES_FROM = 9;
/** The site's version the fake server's set is. */
export const REVISION = "site-scoring-1" as SiteRevision;

/** What the fake server holds: the scoring set as `view` says, the first set by default, which
 *  the reader may edit (the admin); `loading` keeps it on its way (undefined). */
export type ScoringData = { view?: ScoringView; loading?: boolean };

/** The view the fake server gives by default: the first set, as the admin reads it. */
export const ADMINS_VIEW: ScoringView = { part: FIRST_SCORING, revision: REVISION, changesFrom: CHANGES_FROM, canEdit: true };

/** The admin's view of the first set with LIMITED_BANDS added. */
export const VIEW_WITH_LIMITED_BANDS: ScoringView = { ...ADMINS_VIEW, part: { ...FIRST_SCORING, rules: [...FIRST_SCORING.rules, LIMITED_BANDS] } };

/** Saving succeeds from CHANGES_FROM, unless a test says otherwise. */
export function fakeScoring({ view = structuredClone(ADMINS_VIEW), loading = false }: ScoringData = {}) {
  return {
    useScoring: vi.fn<ScoringSeam["useScoring"]>(() => (loading ? undefined : view)),
    save: vi.fn<ScoringSeam["save"]>(async () => CHANGES_FROM),
  };
}
