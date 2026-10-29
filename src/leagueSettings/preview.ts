// League settings in the preview (src/app/preview.ts): the first rules' settings, a change saved now
// taking effect from gameweek 9.

import { FIRST_RULES } from "../../convex/rules/firstRules";
import { leagueSettingsOf } from "../../convex/rules/leagueSettingsPart";
import { previewSays } from "../app/preview";
import { PREVIEW_CHANGES_FROM, PREVIEW_REVISION } from "../rules/preview";
import type { LeagueSettingsSeam } from "./seam";
import { unsavedOutcome } from "./words";

const view = { part: leagueSettingsOf(FIRST_RULES), revision: PREVIEW_REVISION, changesFrom: PREVIEW_CHANGES_FROM };

export const previewLeagueSettings: LeagueSettingsSeam = {
  useSettings: () => view,
  save: previewSays(unsavedOutcome),
};
