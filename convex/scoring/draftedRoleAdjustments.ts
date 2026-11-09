import { FIRST_SCORING } from "./firstScoring";
import type { StoredScoringSet } from "./scoringSetShape";

// The roles' first values (spec/05 Roles; #10): docs/roles-first-values.md, Claude's draft fitted on
// 5 Nov 2026 (Craig, 26 Oct 2026: "Claude drafts the first numbers; Craig edits them later, by
// patch"), as the site's scoring holds them. This file is only where they start: they go into the
// site's set by firstRolesVersion.ts (Craig, 5 Nov 2026: "put roles-first-values.md into the site's
// set now as the starting rules, taking effect from the next gameweek that hasn't begun, with no
// letter"), and change by patch after. Each stat the page names is the live feed's own key for it
// (statCatalogueList.ts); a failed or misplaced count is one of the own stats below.

type OwnStat = NonNullable<StoredScoringSet["ownStats"]>[number];
type RoleScoring = NonNullable<StoredScoringSet["roles"]>[number];
type RoleSide = RoleScoring["bonus"];

/** The page's counts the feed only sends as a total and the accurate ones: the total less them. */
export const FIRST_ROLE_OWN_STATS: readonly OwnStat[] = [
  failed("league:failed_long_balls", "Failed long balls", "FLB", "total_long_balls", "accurate_long_balls"),
  failed("league:failed_crosses", "Failed crosses", "FCR", "total_cross", "accurate_cross"),
  failed("league:misplaced_passes", "Misplaced passes", "MPS", "total_pass", "accurate_pass"),
  failed("league:failed_launches", "Failed launches", "FLA", "total_launches", "accurate_launches"),
];

function failed(stat: string, name: string, shortCode: string, total: string, accurate: string): OwnStat {
  return { stat, name, shortCode, parts: [{ stat: total, weight: 1 }, { stat: accurate, weight: -1 }] };
}

/** A side: its three bars, then each stat with its weight (2 × goals is ["goals_scored", 2]). */
function side(bars: [number, number, number], ...parts: [stat: string, weight: number][]): RoleSide {
  return { bars, parts: parts.map(([stat, weight]) => ({ stat, weight })) };
}

const role = (key: string, bonus: RoleSide, cost: RoleSide): RoleScoring => ({ role: key, bonus, cost });

/** Every role of the default set (lineup/roles.ts), in the page's order. */
export const FIRST_ROLES: readonly RoleScoring[] = [
  // Strikers.
  role("poacher", side([2, 3, 4], ["att_ibox_goal", 2], ["att_ibox_target", 1]), side([1, 4, 7], ["big_chance_missed", 1])),
  role("targetMan", side([4, 5, 6], ["aerial_won", 1], ["accurate_flick_on", 1], ["accurate_layoffs", 1]), side([5, 8, 11], ["aerial_lost", 1])),
  role(
    "inBehindStriker",
    side([5, 6, 7], ["shot_fastbreak", 2], ["progressive_carries", 1], ["pen_area_entries_open_play", 1], ["fouled_final_third", 1]),
    side([1, 2, 3], ["total_offside", 1]),
  ),
  role("pressingForward", side([2, 3, 4], ["poss_won_att_3rd", 2], ["poss_won_mid_3rd", 1], ["won_tackle", 1]), side([1, 4, 7], ["fouls", 1])),
  role(
    "shadowStriker",
    side([1, 2, 3], ["successful_final_third_entries", 1], ["pen_area_entries", 1], ["attempts_obox", 1]),
    side([3, 4, 5], ["unsuccessful_touch", 1], ["total_offside", 1]),
  ),
  role(
    "falseNine",
    side([3, 4, 5], ["accurate_through_ball", 1], ["shot_created", 1], ["progressive_carries", 1], ["big_chance_created", 1]),
    side([1, 2, 3], ["dispossessed", 1]),
  ),
  // Wingers (wide attacking midfield).
  role("winger", side([3, 4, 5], ["accurate_cross_nocorner", 1], ["won_contest", 1], ["total_att_assist", 1]), side([2, 3, 4], ["dispossessed", 1])),
  role("dribbler", side([6, 7, 8], ["won_contest", 1], ["progressive_carries", 1], ["fouled_final_third", 1]), side([1, 5, 9], ["dispossessed", 1])),
  role(
    "insideForward",
    side([3, 4, 5], ["ontarget_scoring_att", 1], ["attempts_ibox", 1], ["goals_scored", 2]),
    side([1, 2, 3], ["big_chance_missed", 1]),
  ),
  role(
    "widePlaymaker",
    side([7, 8, 9], ["shot_created", 1], ["accurate_through_ball", 1], ["successful_final_third_passes", 1]),
    side([11, 13, 15], ["poss_lost_all", 1]),
  ),
  role(
    "wideForward",
    side([2, 3, 4], ["shot_fastbreak", 2], ["pen_area_entries_open_play", 1], ["fouled_final_third", 1]),
    side([1, 2, 3], ["total_offside", 1]),
  ),
  role("pressingWinger", side([1, 2, 3], ["poss_won_att_3rd", 2], ["won_tackle", 1]), side([1, 2, 3], ["fouls", 1])),
  role(
    "trackingWinger",
    side([2, 3, 4], ["won_tackle", 1], ["interception", 1], ["poss_won_mid_3rd", 1], ["poss_won_def_3rd", 1]),
    side([1, 2, 3], ["fouls", 1], ["challenge_lost", 1]),
  ),
  // Attacking midfield, centre.
  role(
    "numberTen",
    side([2, 4, 6], ["total_att_assist", 1], ["big_chance_created", 2], ["accurate_through_ball", 1]),
    side([1, 2, 3], ["shot_off_target", 1]),
  ),
  role(
    "attackingMidfieldShadowStriker",
    side([3, 6, 9], ["pen_area_entries", 1], ["ontarget_scoring_att", 2], ["attempts_obox", 1]),
    side([1, 2, 3], ["total_offside", 1]),
  ),
  role(
    "maverick",
    side([2, 3, 4], ["total_through_ball", 1], ["accurate_long_balls", 1], ["accurate_chipped_pass", 1], ["ontarget_scoring_att", 1]),
    side([2, 3, 4], ["unsuccessful_touch", 1]),
  ),
  role("carrier", side([3, 5, 7], ["won_contest", 1], ["progressive_carries", 1], ["fouled_final_third", 1]), side([1, 2, 3], ["dispossessed", 1])),
  role(
    "pressingTen",
    side([4, 5, 6], ["poss_won_att_3rd", 2], ["won_tackle", 1], ["ball_recovery", 0.5]),
    side([2, 3, 4], ["fouls", 1]),
  ),
  // Wide midfield.
  role(
    "wideMidfielder",
    side([4, 5, 6], ["ball_recovery", 0.5], ["successful_final_third_passes", 1], ["total_tackle", 1]),
    side([1, 2, 3], ["fouls", 1]),
  ),
  role("defensiveWinger", side([2, 3, 4], ["total_tackle", 1], ["interception", 1], ["outfielder_block", 1]), side([2, 3, 4], ["challenge_lost", 1])),
  role("wideMidfieldPlaymaker", side([2, 3, 4], ["accurate_long_balls", 1], ["total_att_assist", 1]), side([4, 5, 6], ["league:failed_long_balls", 1])),
  role(
    "crosser",
    side([2, 3, 4], ["accurate_cross", 1], ["total_cross", 0.5], ["big_chance_created", 1]),
    side([7, 10, 13], ["league:failed_crosses", 1]),
  ),
  role("wideMidfieldWinger", side([1, 2, 3], ["won_contest", 1], ["was_fouled", 1], ["accurate_cross", 0.5]), side([1, 2, 3], ["dispossessed", 1])),
  // Keepers.
  role(
    "shotStopper",
    side([4, 5, 6], ["saves", 1], ["big_chance_saves", 1], ["penalties_saved", 3]),
    side([1, 2, 3], ["goals_conceded_obox", 1]),
  ),
  role(
    "sweeperKeeper",
    side([5, 6, 7], ["accurate_keeper_sweeper", 2], ["gk_smother", 2], ["effective_clearance", 1], ["progressive_carries", 1]),
    side([2, 3, 4], ["error_lead_to_shot", 1], ["error_lead_to_goal", 1]),
  ),
  role(
    "distributor",
    side([8, 10, 12], ["long_pass_own_to_opp_success", 1], ["fwd_pass", 0.5], ["accurate_keeper_throws", 0.5]),
    side([11, 13, 15], ["league:failed_launches", 1]),
  ),
  role(
    "commandingKeeper",
    side([2, 3, 4], ["good_high_claim", 2], ["punches", 1], ["aerial_won", 1], ["dive_catch", 1]),
    side([2, 3, 4], ["cross_not_claimed", 1], ["goals_conceded_ibox", 1]),
  ),
  // Central midfield.
  role(
    "boxToBox",
    side([3, 4, 5], ["pen_area_entries", 1], ["ball_recovery", 0.5], ["won_tackle", 1], ["ontarget_scoring_att", 1]),
    side([1, 3, 5], ["unsuccessful_touch", 1]),
  ),
  role("ballWinner", side([2, 3, 4], ["won_tackle", 1], ["interception", 1], ["poss_won_mid_3rd", 1]), side([1, 2, 3], ["fouls", 1])),
  role("attackingEight", side([7, 8, 9], ["progressive_carries", 1], ["pen_area_entries", 2], ["won_contest", 1]), side([3, 5, 7], ["dispossessed", 1])),
  role("midfieldEngine", side([8, 9, 10], ["ball_recovery", 1], ["interception", 1], ["accurate_pass", 0.1]), side([2, 3, 4], ["challenge_lost", 1])),
  role("lateRunner", side([1, 2, 3], ["ontarget_scoring_att", 1], ["pen_area_entries", 1], ["goals_scored", 2]), side([2, 3, 4], ["big_chance_missed", 1])),
  // Wing-backs.
  role(
    "attackingWingBack",
    side([2, 3, 4], ["accurate_cross_nocorner", 1], ["pen_area_entries", 1], ["total_att_assist", 1]),
    side([3, 4, 5], ["dispossessed", 1]),
  ),
  role("holdingWingBack", side([3, 4, 5], ["won_tackle", 1], ["interception", 1], ["ball_recovery", 0.5]), side([1, 4, 7], ["challenge_lost", 1])),
  role(
    "completeWingBack",
    side([3, 4, 5], ["progressive_carries", 1], ["accurate_cross", 1], ["ball_recovery", 0.5]),
    side([1, 2, 3], ["unsuccessful_touch", 1]),
  ),
  role(
    "invertedWingBack",
    side([5, 6, 7], ["accurate_pass", 0.1], ["successful_final_third_passes", 0.5], ["won_contest", 1]),
    side([1, 2, 3], ["fouls", 1]),
  ),
  role(
    "goalscoringWingBack",
    side([3, 4, 5], ["ontarget_scoring_att", 1], ["touches_in_opp_box", 1], ["pen_area_entries", 1], ["goals_scored", 2]),
    side([2, 3, 4], ["big_chance_missed", 1]),
  ),
  // Full-backs.
  role(
    "overlappingFullBack",
    side([3, 4, 5], ["accurate_cross", 2], ["total_cross", 1], ["won_contest", 1]),
    side([1, 5, 9], ["dispossessed", 1]),
  ),
  role(
    "underlappingFullBack",
    side([5, 6, 7], ["pen_area_entries", 1], ["progressive_carries", 1], ["final_third_entries", 1]),
    side([1, 3, 5], ["unsuccessful_touch", 1], ["total_offside", 1]),
  ),
  role("invertedFullBack", side([6, 7, 8], ["accurate_pass", 0.1], ["successful_final_third_passes", 0.5]), side([11, 12, 13], ["league:misplaced_passes", 1])),
  role(
    "playmakingFullBack",
    side([2, 3, 4], ["long_pass_own_to_opp_success", 1], ["accurate_long_balls", 1], ["big_chance_created", 2]),
    side([2, 3, 4], ["league:failed_long_balls", 1]),
  ),
  role(
    "defensiveFullBack",
    side([5, 6, 7], ["won_tackle", 1], ["interception", 1], ["effective_clearance", 1]),
    side([3, 4, 5], ["challenge_lost", 1]),
  ),
  // Defensive midfield.
  role("metronome", side([7, 8, 9], ["accurate_pass", 0.1], ["fwd_pass", 0.2]), side([8, 9, 10], ["league:misplaced_passes", 1])),
  role(
    "quarterback",
    side([8, 9, 10], ["long_pass_own_to_opp_success", 1], ["accurate_long_balls", 1], ["accurate_chipped_pass", 1]),
    side([6, 7, 8], ["league:failed_long_balls", 1]),
  ),
  role(
    "halfBack",
    side([3, 5, 7], ["effective_clearance", 1], ["aerial_won", 1], ["poss_won_def_3rd", 1]),
    side([1, 2, 3], ["error_lead_to_shot", 1], ["error_lead_to_goal", 1]),
  ),
  role("engine", side([10, 11, 12], ["ball_recovery", 1], ["interception", 1], ["accurate_pass", 0.1]), side([3, 5, 7], ["challenge_lost", 1])),
  role("tower", side([3, 4, 5], ["aerial_won", 1], ["effective_head_clearance", 1], ["head_pass", 1]), side([1, 5, 9], ["aerial_lost", 1])),
  role("destroyer", side([6, 7, 8], ["won_tackle", 2], ["duel_won", 1]), side([5, 6, 7], ["fouls", 1])),
  // Centre-backs.
  role("stopper", side([4, 5, 6], ["won_tackle", 1], ["aerial_won", 1], ["interception", 1]), side([3, 4, 5], ["challenge_lost", 1])),
  role(
    "ballPlayingDefender",
    side([10, 11, 12], ["long_pass_own_to_opp_success", 1], ["fwd_pass", 0.2], ["accurate_long_balls", 1]),
    side([7, 8, 9], ["league:failed_long_balls", 1]),
  ),
  role(
    "noNonsenseCentreBack",
    side([9, 10, 11], ["effective_clearance", 1], ["effective_head_clearance", 1], ["outfielder_block", 1]),
    side([1, 2, 3], ["error_lead_to_shot", 1], ["error_lead_to_goal", 1]),
  ),
  role(
    "attackingCentreBack",
    side([5, 6, 7], ["att_hd_total", 1], ["pen_area_entries", 1], ["progressive_carries", 1]),
    side([1, 2, 3], ["dispossessed", 1]),
  ),
  role(
    "sweeper",
    side([4, 5, 6], ["interception", 1], ["ball_recovery", 1], ["clearance_off_line", 3]),
    side([1, 2, 3], ["error_lead_to_shot", 1], ["error_lead_to_goal", 1]),
  ),
  role(
    "libero",
    side([11, 13, 15], ["progressive_carries", 1], ["accurate_pass", 0.1], ["final_third_entries", 1]),
    side([2, 3, 4], ["unsuccessful_touch", 1]),
  ),
];

/** The first scoring with these values in it, as firstRolesVersion.ts first put them into the
 *  site's set: what the Tactics preview and its tests price a role card under (#848). */
export const FIRST_SCORING_WITH_ROLES: StoredScoringSet = { ...FIRST_SCORING, ownStats: [...FIRST_ROLE_OWN_STATS], roles: [...FIRST_ROLES] };
