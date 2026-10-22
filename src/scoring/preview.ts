// The rules editor in the preview (src/preview.ts): the first scoring set, a change saved now
// taking effect from gameweek 9.

import { FIRST_RULES } from "../../convex/rules/firstRules";
import { previewSays } from "../preview";
import type { Revision } from "../rules/rulesDraft";
import type { ScoringSeam } from "./seam";

const PREVIEW_CHANGES_FROM = 9;
const view = { part: FIRST_RULES.scoring, revision: "preview-rules" as Revision, changesFrom: PREVIEW_CHANGES_FROM };

export const previewScoring: ScoringSeam = {
  useScoring: () => view,
  save: previewSays("the scoring didn't change"),
};
