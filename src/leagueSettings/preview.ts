// League settings in the preview (src/app/preview.ts): the first rules' settings, a change saved now
// taking effect from gameweek 9, and the preview league's teams in the order they joined.

import type { Id } from "../../convex/_generated/dataModel";
import { FIRST_RULES } from "../../convex/rules/firstRules";
import { HOUR_MS } from "../../convex/shared/time";
import { leagueSettingsOf } from "../../convex/rules/leagueSettingsPart";
import { previewChristmasBreak, previewSays, previewSeasonGameweeks, previewTeamNames } from "../shared/preview";
import { previewSeason } from "../gameweeks/preview";
import { PREVIEW_CHANGES_FROM, PREVIEW_REVISION } from "../rules/preview";
import { previewIdOf } from "../shared/previewDraw";
import type { LeagueSettingsSeam } from "./seam";
import { previewClaims, previewWaivers } from "../myTeam/claims/preview";
import { unchangedDraftStartOutcome, unchangedStartOutcome, unmovedOutcome, unsavedOutcome } from "./words";

const view = {
  part: leagueSettingsOf(FIRST_RULES),
  revision: PREVIEW_REVISION,
  changesFrom: PREVIEW_CHANGES_FROM,
  seasonGameweeks: previewSeasonGameweeks,
  presetNames: FIRST_RULES.presets.map(({ name }) => name),
};
const teamOrder = { teams: previewTeamNames.map((name) => ({ teamId: previewIdOf(name), name })), started: false };
/** The gameweeks screen's made-up season, scoring from just after its Christmas break. */
const scoringStart = {
  start: Math.max(...previewChristmasBreak) + 1,
  ticked: previewSeason.filter(({ used }) => used).map(({ gameweek, deadline }) => ({ gameweek, deadline })),
  seasonBegun: false,
};

/** The draft waiting for the commissioner, with no date set, its rounds the first rules' squad. */
const draftStart = { startsAt: null, started: false, rounds: view.part.squadMaximum, teams: teamOrder.teams.length };

/** One trade in review between two other teams, ending tomorrow: the commissioner's to review. */
const tradesInReview = [
  {
    offerId: "preview-review-1" as Id<"tradeOffers">,
    fromTeamName: previewTeamNames[1],
    toTeamName: previewTeamNames[4],
    reviewEndsAt: Date.now() + 20 * HOUR_MS,
    opens: true,
  },
];

export const previewLeagueSettings: LeagueSettingsSeam = {
  useSettings: () => view,
  save: previewSays(unsavedOutcome),
  useTeamOrder: () => teamOrder,
  saveTeamOrder: previewSays(unmovedOutcome),
  drawTeamOrder: previewSays(unmovedOutcome),
  useScoringStart: () => scoringStart,
  setScoringStart: previewSays(unchangedStartOutcome),
  useGameweeks: () => previewSeason,
  useDraftStart: () => draftStart,
  setDraftStart: previewSays(unchangedDraftStartOutcome),
  useWaivers: () => previewWaivers,
  usePendingClaims: previewClaims.usePendingClaims,
  useTradesInReview: () => tradesInReview,
};
