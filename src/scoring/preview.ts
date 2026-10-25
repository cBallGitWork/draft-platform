// Player scoring in the preview (src/preview.ts): the first scoring set as the admin edits it, a
// change saved now taking effect from gameweek 9.

import { FIRST_SCORING } from "../../convex/scoring/firstScoring";
import { previewSays } from "../preview";
import { PREVIEW_CHANGES_FROM } from "../rules/preview";
import type { ScoringSeam } from "./seam";
import { unsavedOutcome } from "./words";

const view = { part: FIRST_SCORING, revision: null, changesFrom: PREVIEW_CHANGES_FROM, canEdit: true };

export const previewScoring: ScoringSeam = {
  useScoring: () => view,
  save: previewSays(unsavedOutcome),
};
