// The rules editor in the preview (src/preview.ts): the first scoring set, a change saved now
// taking effect from gameweek 9.

import { FIRST_RULES } from "../../convex/rules/firstRules";
import { previewSays } from "../preview";
import { PREVIEW_CHANGES_FROM, PREVIEW_REVISION } from "../rules/preview";
import type { ScoringSeam } from "./seam";

const view = { part: FIRST_RULES.scoring, revision: PREVIEW_REVISION, changesFrom: PREVIEW_CHANGES_FROM };

export const previewScoring: ScoringSeam = {
  useScoring: () => view,
  save: previewSays("the scoring didn't change"),
};
