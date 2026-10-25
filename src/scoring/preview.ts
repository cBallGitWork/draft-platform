// Player scoring in the preview (src/preview.ts): the first scoring set, which the admin edits, a
// change saved now taking effect from gameweek 9, and everyone else reads.

import { FIRST_SCORING } from "../../convex/scoring/firstScoring";
import type { Session } from "../auth";
import { previewSays } from "../preview";
import { PREVIEW_CHANGES_FROM } from "../rules/preview";
import type { ScoringSeam } from "./seam";
import { unsavedOutcome } from "./words";

/** The preview's seam for `session`: editable for the admin alone, as the server judges it. */
export function previewScoringFor(session: Session): ScoringSeam {
  const view = { part: FIRST_SCORING, revision: null, changesFrom: PREVIEW_CHANGES_FROM, canEdit: session.signedIn && session.isAdmin };
  return { useScoring: () => view, save: previewSays(unsavedOutcome) };
}
