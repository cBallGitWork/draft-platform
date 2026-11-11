// League settings in the preview (src/app/preview.ts): the first rules' settings, a change saved now
// taking effect from gameweek 9, and the preview league's teams in the order they joined.

import { FIRST_RULES } from "../../convex/rules/firstRules";
import { leagueSettingsOf } from "../../convex/rules/leagueSettingsPart";
import { previewChristmasBreak, previewSays } from "../shared/preview";
import { previewSeason } from "../gameweeks/preview";
import { PREVIEW_CHANGES_FROM, PREVIEW_REVISION } from "../rules/preview";
import { previewIdOf, previewTeams } from "../table/preview";
import type { LeagueSettingsSeam } from "./seam";
import { previewWaivers } from "../myTeam/claims/preview";
import { unchangedDraftStartOutcome, unchangedStartOutcome, unmovedOutcome, unsavedOutcome } from "./words";

const view = { part: leagueSettingsOf(FIRST_RULES), revision: PREVIEW_REVISION, changesFrom: PREVIEW_CHANGES_FROM };
const teamOrder = { teams: previewTeams.map((name) => ({ teamId: previewIdOf(name), name })), started: false };
/** The gameweeks screen's made-up season, scoring from just after its Christmas break. */
const scoringStart = {
  start: Math.max(...previewChristmasBreak) + 1,
  ticked: previewSeason.filter(({ used }) => used).map(({ gameweek, deadline }) => ({ gameweek, deadline })),
};

/** The draft waiting for the commissioner, with no date set. */
const draftStart = { startsAt: null, started: false };

export const previewLeagueSettings: LeagueSettingsSeam = {
  useSettings: () => view,
  save: previewSays(unsavedOutcome),
  useTeamOrder: () => teamOrder,
  saveTeamOrder: previewSays(unmovedOutcome),
  drawTeamOrder: previewSays(unmovedOutcome),
  useScoringStart: () => scoringStart,
  setScoringStart: previewSays(unchangedStartOutcome),
  useDraftStart: () => draftStart,
  setDraftStart: previewSays(unchangedDraftStartOutcome),
  useWaivers: () => previewWaivers,
};
