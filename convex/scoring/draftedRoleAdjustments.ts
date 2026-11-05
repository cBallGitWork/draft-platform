import type { RoleAdjustments } from "./scoringSet";

// Claude's first draft of each role's adjustment (spec/05 Roles; Craig, 26 Oct 2026: "Claude
// drafts the first numbers; Craig edits them later, by patch"). Every role gives something and
// takes something, flat points per action, on one stat of each side of its bonus and cost in
// docs/roles-first-values.md (#989). They aren't in any scoring set: the admin puts them in a
// patch, announced a week ahead like any change (spec/14), so no gameweek's points move until
// then. Unbalanced until #457 checks them against last season.

const adjust = (role: string, ...adjustments: [stat: string, points: number][]): RoleAdjustments => ({
  role,
  adjustments: adjustments.map(([stat, points]) => ({ stat, points })),
});

export const DRAFTED_ROLE_ADJUSTMENTS: readonly RoleAdjustments[] = [
  adjust("shotStopper", ["saves", 0.5], ["goals_conceded_obox", -1]),
  adjust("sweeperKeeper", ["accurate_keeper_sweeper", 1], ["error_lead_to_shot", -1]),
  adjust("distributor", ["accurate_launches", 0.5], ["total_launches", -0.5]),
  adjust("commandingKeeper", ["good_high_claim", 1], ["cross_not_claimed", -1]),
  adjust("overlappingFullBack", ["accurate_cross", 1], ["dispossessed", -0.5]),
  adjust("underlappingFullBack", ["pen_area_entries", 0.5], ["unsuccessful_touch", -0.5]),
  adjust("invertedFullBack", ["successful_final_third_passes", 0.5], ["poss_lost_ctrl", -0.5]),
  adjust("playmakingFullBack", ["accurate_long_balls", 0.5], ["total_long_balls", -0.5]),
  adjust("defensiveFullBack", ["clearances_blocks_interceptions", 0.5], ["accurate_cross", -0.5]),
  adjust("stopper", ["won_tackle", 0.5], ["challenge_lost", -0.5]),
  adjust("ballPlayingDefender", ["accurate_long_balls", 0.5], ["total_long_balls", -0.5]),
  adjust("noNonsenseCentreBack", ["effective_clearance", 0.5], ["error_lead_to_shot", -1]),
  adjust("attackingCentreBack", ["att_hd_total", 1], ["dispossessed", -1]),
  adjust("sweeper", ["clearances_blocks_interceptions", 0.5], ["error_lead_to_shot", -1]),
  adjust("libero", ["progressive_carries", 0.5], ["unsuccessful_touch", -0.5]),
  adjust("attackingWingBack", ["accurate_cross", 1], ["dispossessed", -0.5]),
  adjust("holdingWingBack", ["won_tackle", 0.5], ["challenge_lost", -0.5]),
  adjust("completeWingBack", ["progressive_carries", 0.5], ["unsuccessful_touch", -0.5]),
  adjust("invertedWingBack", ["successful_final_third_passes", 0.5], ["fouls", -0.5]),
  adjust("goalscoringWingBack", ["ontarget_scoring_att", 1], ["big_chance_missed", -1]),
  adjust("metronome", ["successful_open_play_pass", 0.1], ["poss_lost_ctrl", -0.5]),
  adjust("quarterback", ["accurate_long_balls", 0.5], ["total_long_balls", -0.5]),
  adjust("halfBack", ["effective_clearance", 0.5], ["error_lead_to_shot", -1]),
  adjust("engine", ["ball_recovery", 0.5], ["challenge_lost", -0.5]),
  adjust("tower", ["aerial_won", 0.5], ["aerial_lost", -0.5]),
  adjust("destroyer", ["won_tackle", 0.5], ["fouls", -0.5]),
  adjust("wideMidfielder", ["ball_recovery", 0.5], ["fouls", -0.5]),
  adjust("defensiveWinger", ["won_tackle", 0.5], ["challenge_lost", -0.5]),
  adjust("wideMidfieldPlaymaker", ["accurate_long_balls", 0.5], ["total_long_balls", -0.5]),
  adjust("crosser", ["accurate_cross", 1], ["total_cross", -0.5]),
  adjust("wideMidfieldWinger", ["won_contest", 0.5], ["dispossessed", -0.5]),
  adjust("boxToBox", ["total_scoring_att", 0.5], ["unsuccessful_touch", -0.5]),
  adjust("ballWinner", ["won_tackle", 0.5], ["fouls", -0.5]),
  adjust("attackingEight", ["progressive_carries", 0.5], ["dispossessed", -0.5]),
  adjust("midfieldEngine", ["ball_recovery", 0.5], ["challenge_lost", -0.5]),
  adjust("lateRunner", ["ontarget_scoring_att", 1], ["big_chance_missed", -1]),
  adjust("winger", ["accurate_cross", 1], ["dispossessed", -0.5]),
  adjust("dribbler", ["won_contest", 0.5], ["dispossessed", -0.5]),
  adjust("insideForward", ["ontarget_scoring_att", 0.5], ["big_chance_missed", -1]),
  adjust("widePlaymaker", ["shot_created", 0.5], ["poss_lost_all", -0.5]),
  adjust("wideForward", ["shot_fastbreak", 1], ["total_offside", -0.5]),
  adjust("pressingWinger", ["poss_won_att_3rd", 1], ["fouls", -0.5]),
  adjust("trackingWinger", ["won_tackle", 0.5], ["challenge_lost", -0.5]),
  adjust("numberTen", ["big_chance_created", 1], ["shot_off_target", -0.5]),
  adjust("attackingMidfieldShadowStriker", ["ontarget_scoring_att", 0.5], ["total_offside", -0.5]),
  adjust("maverick", ["accurate_through_ball", 1], ["unsuccessful_touch", -0.5]),
  adjust("carrier", ["progressive_carries", 0.5], ["dispossessed", -0.5]),
  adjust("pressingTen", ["poss_won_att_3rd", 1], ["fouls", -0.5]),
  adjust("poacher", ["goals_scored", 1], ["big_chance_missed", -1]),
  adjust("targetMan", ["aerial_won", 0.5], ["aerial_lost", -0.5]),
  adjust("inBehindStriker", ["shot_fastbreak", 1], ["total_offside", -0.5]),
  adjust("pressingForward", ["poss_won_att_3rd", 1], ["fouls", -0.5]),
  adjust("shadowStriker", ["successful_pen_area_entries", 0.5], ["total_offside", -0.5]),
  adjust("falseNine", ["big_chance_created", 1], ["dispossessed", -0.5]),
];
