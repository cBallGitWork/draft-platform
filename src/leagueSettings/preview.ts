// League settings in the preview (src/preview.ts): the first rules' settings, a change saved now
// taking effect from gameweek 9.

import { drawRulesOf, FIRST_RULES } from "../../convex/rules/firstRules";
import { previewSays } from "../preview";
import { PREVIEW_CHANGES_FROM, PREVIEW_REVISION } from "../rules/preview";
import type { LeagueSettingsSeam } from "./seam";

const view = { part: drawRulesOf(FIRST_RULES), revision: PREVIEW_REVISION, changesFrom: PREVIEW_CHANGES_FROM };

export const previewLeagueSettings: LeagueSettingsSeam = {
  useSettings: () => view,
  save: previewSays("the settings didn't change"),
};
