// League settings in the preview (src/preview.ts): the first rules' settings, a change saved now
// taking effect from gameweek 9.

import { drawRulesOf, FIRST_RULES } from "../../convex/rules/firstRules";
import { previewSays } from "../preview";
import type { Revision } from "../rules/rulesDraft";
import type { LeagueSettingsSeam } from "./seam";

const PREVIEW_CHANGES_FROM = 9;
const view = { part: drawRulesOf(FIRST_RULES), revision: "preview-rules" as Revision, changesFrom: PREVIEW_CHANGES_FROM };

export const previewLeagueSettings: LeagueSettingsSeam = {
  useSettings: () => view,
  save: previewSays("the settings didn't change"),
};
