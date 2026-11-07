// Player scoring in the preview (src/app/preview.ts): the first scoring set, which the admin edits, a
// change saved now taking effect from gameweek 9, and everyone else reads. No version yet, and a
// draft patch saved, which can be announced from gameweek 10 or 11, a week apart, and the lab run on.

import type { LabReport } from "../../convex/balanceLab/labReportShape";
import { FIRST_SCORING } from "../../convex/scoring/firstScoring";
import { DAY_MS, WEEK_MS } from "../../convex/shared/time";
import type { Session } from "../signIn/seam";
import { previewSays } from "../app/preview";
import { PREVIEW_CHANGES_FROM } from "../rules/preview";
import type { ScoringSeam, ScoringView } from "./seam";
import { unsavedOutcome } from "./words";

/** The preview's seam for `session`: editable for the admin alone, as the server judges it. */
export function previewScoringFor(session: Session): ScoringSeam {
  const firstPatchAt = Date.now() + 8 * DAY_MS;
  const view: ScoringView = {
    part: FIRST_SCORING,
    revision: null,
    changesFrom: PREVIEW_CHANGES_FROM,
    canEdit: session.signedIn && session.isAdmin,
    versions: [],
    // A draft saved, so the lab can be run on it (#843).
    draft: { part: FIRST_SCORING, savedAt: Date.now() },
    patchGameweeks: [0, 1].map((later) => ({ gameweek: PREVIEW_CHANGES_FROM + 1 + later, takesEffectAt: firstPatchAt + later * WEEK_MS })),
  };
  const says = previewSays(unsavedOutcome);
  return { useScoring: () => view, save: says, saveDraft: says, announce: says, withdraw: says, runLab: async () => PREVIEW_LAB };
}

/** The lab's report in the preview: one role tested on target, one off it, one not tested. */
const PREVIEW_LAB: LabReport = {
  seasons: [2021, 2022, 2023, 2024, 2025],
  starts: 41820,
  startsSkipped: 96,
  roles: [
    { role: "shotStopper", slot: "GK", target: 0.9, starts: 1900, average: 0.82, offTarget: false },
    { role: "distributor", slot: "GK", target: 0.9, starts: 1900, average: 1.31, offTarget: true },
    { role: "poacher", slot: "ST", target: 0.5, missing: ["att_ibox_goal", "att_ibox_target", "big_chance_missed"] },
  ],
};
