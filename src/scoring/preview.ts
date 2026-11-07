// Player scoring in the preview (src/app/preview.ts): the first scoring set, which the admin edits, a
// change saved now taking effect from gameweek 9, and everyone else reads. No version or draft yet;
// a patch can be announced from gameweek 10 or 11, a week apart.

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
    draft: null,
    patchGameweeks: [0, 1].map((later) => ({ gameweek: PREVIEW_CHANGES_FROM + 1 + later, takesEffectAt: firstPatchAt + later * WEEK_MS })),
  };
  const says = previewSays(unsavedOutcome);
  return { useScoring: () => view, save: says, saveDraft: says, announce: says, withdraw: says };
}
