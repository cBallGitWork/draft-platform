// League settings in the preview (src/app/preview.ts): the first rules' settings, a change saved now
// taking effect from gameweek 9, and the preview league's teams in the order they joined.

import { FIRST_RULES } from "../../convex/rules/firstRules";
import { leagueSettingsOf } from "../../convex/rules/leagueSettingsPart";
import { previewSays } from "../shared/preview";
import { PREVIEW_CHANGES_FROM, PREVIEW_REVISION } from "../rules/preview";
import { previewIdOf, previewTeams } from "../table/preview";
import type { LeagueSettingsSeam } from "./seam";
import { unmovedOutcome, unsavedOutcome } from "./words";

const view = { part: leagueSettingsOf(FIRST_RULES), revision: PREVIEW_REVISION, changesFrom: PREVIEW_CHANGES_FROM };
const teamOrder = { teams: previewTeams.map((name) => ({ teamId: previewIdOf(name), name })), started: false };

export const previewLeagueSettings: LeagueSettingsSeam = {
  useSettings: () => view,
  save: previewSays(unsavedOutcome),
  useTeamOrder: () => teamOrder,
  saveTeamOrder: previewSays(unmovedOutcome),
  drawTeamOrder: previewSays(unmovedOutcome),
};
