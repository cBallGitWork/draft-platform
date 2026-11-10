// Each catalogue stat (scoring/statCatalogueList.ts) and Sportmonks' statistic type id for it, or
// marked as one Sportmonks doesn't send (#1391), in one table: tests/convex/football/sportmonks
// fails on a catalogue stat with neither, so a stat added to the catalogue needs a decision here.
// The ids are Sportmonks' statistic types as `lineups.details` sends them: its docs' player list,
// and the 60 types the starters of three finished Scottish Premiership matches carried (checked
// 9 Nov 2026, on #1391, against `/v3/core/types`). Sportmonks has no in-box split, no shot
// placement, no FPL index and no pass zones, which is most of what is missing (Craig, 9 Nov 2026,
// on #1196). Clearances off the line have two types (582, 2271) and no match sent either, so the
// stat waits for one that does.

/** A catalogue stat Sportmonks doesn't send. */
export const MISSING = "missing";

/** The catalogue stats Sportmonks sends, by its statistic type id. Two catalogue stats can share
 *  one: the catalogue holds FPL's `tackles` and Opta's `total_tackle`, both Sportmonks' TACKLES. */
export const SPORTMONKS_STAT_IDS: Readonly<Record<string, number>> = {
  accurate_cross: 99, // ACCURATE_CROSSES
  accurate_long_balls: 123, // LONG_BALLS_WON
  accurate_pass: 116, // ACCURATE_PASSES
  accurate_through_ball: 125, // THROUGH_BALLS_WON
  aerial_lost: 27266, // AERIALS_LOST
  aerial_won: 107, // AERIALS_WON
  assists: 79, // ASSISTS
  att_pen_goal: 111, // PENALTIES_SCORED
  backward_pass: 27272, // BACKWARD_PASSES
  ball_recovery: 27271, // BALL_RECOVERY
  big_chance_created: 580, // BIG_CHANCES_CREATED
  big_chance_missed: 581, // BIG_CHANCES_MISSED
  blocked_scoring_att: 58, // SHOTS_BLOCKED
  challenge_lost: 110, // DRIBBLED_PAST
  clean_sheets: 194, // CLEANSHEET
  dispossessed: 94, // DISPOSSESSED
  duel_lost: 1491, // DUELS_LOST
  duel_won: 106, // DUELS_WON
  error_lead_to_goal: 571, // ERROR_LEAD_TO_GOAL
  error_lead_to_shot: 48997, // ERROR_LEAD_TO_SHOT
  expected_goals: 5304, // EXPECTED_GOALS
  fouls: 56, // FOULS
  goals_conceded: 88, // GOALS_CONCEDED
  goals_scored: 52, // GOALS
  good_high_claim: 584, // GOOD_HIGH_CLAIM
  hit_woodwork: 64, // HIT_WOODWORK
  interception: 100, // INTERCEPTIONS
  last_man_tackle: 583, // LAST_MAN_TACKLE
  minutes: 119, // MINUTES_PLAYED
  ontarget_scoring_att: 86, // SHOTS_ON_TARGET
  outfielder_block: 97, // BLOCKED_SHOTS
  own_goals: 324, // OWN_GOALS
  penalties_missed: 112, // PENALTIES_MISSES
  penalties_saved: 113, // PENALTIES_SAVED
  penalty_conceded: 114, // PENALTIES_COMMITTED
  penalty_won: 115, // PENALTIES_WON
  poss_lost_all: 27273, // POSSESSION_LOST
  punches: 103, // PUNCHES
  recoveries: 27271, // BALL_RECOVERY
  red_cards: 83, // REDCARDS
  saved_ibox: 104, // SAVES_INSIDE_BOX
  saves: 57, // SAVES
  second_yellow: 85, // YELLOWRED_CARDS
  shot_off_target: 41, // SHOTS_OFF_TARGET
  tackles: 78, // TACKLES
  total_att_assist: 117, // KEY_PASSES
  total_clearance: 101, // CLEARANCES
  total_contest: 108, // DRIBBLE_ATTEMPTS
  total_cross: 98, // TOTAL_CROSSES
  total_long_balls: 122, // LONG_BALLS
  total_offside: 51, // OFFSIDES
  total_pass: 80, // PASSES
  total_scoring_att: 42, // SHOTS_TOTAL
  total_tackle: 78, // TACKLES
  total_through_ball: 124, // THROUGH_BALLS
  touches: 120, // TOUCHES
  was_fouled: 96, // FOULS_DRAWN
  won_contest: 109, // SUCCESSFUL_DRIBBLES
  won_tackle: 27267, // TACKLES_WON
  yellow_cards: 84, // YELLOWCARDS
};

/** The catalogue stats Sportmonks doesn't send. A match's appearance, start, subs, result and
 *  winning goal come from its lineups, events and score, never a statistic type; so would the
 *  half-time clean sheet and goals conceded (#990), from its goal events' minutes. */
export const NOT_IN_SPORTMONKS: readonly string[] = [
  "clean_sheet_half_time", "goals_conceded_half_time",
  "accurate_back_zone_pass", "accurate_chipped_pass", "accurate_corners_intobox", "accurate_cross_nocorner", "accurate_flick_on",
  "accurate_freekick_cross", "accurate_fwd_zone_pass", "accurate_goal_kicks", "accurate_keeper_sweeper",
  "accurate_keeper_throws", "accurate_launches", "accurate_layoffs", "accurate_pull_back", "accurate_throws", "appearances",
  "assist_attempt_saved", "assist_blocked_shot", "assist_free_kick_won", "assist_handball_won", "assist_own_goal",
  "assist_pass_lost", "assist_penalty_won", "assist_post", "att_assist_openplay", "att_assist_setplay", "att_bx_centre",
  "att_bx_left", "att_bx_right", "att_cmiss_high", "att_cmiss_high_left", "att_cmiss_high_right", "att_cmiss_left",
  "att_cmiss_right", "att_corner", "att_fastbreak", "att_freekick_goal", "att_freekick_miss", "att_freekick_post",
  "att_freekick_target", "att_freekick_total", "att_goal_high_centre", "att_goal_high_left", "att_goal_high_right",
  "att_goal_low_centre", "att_goal_low_left", "att_goal_low_right", "att_hd_goal", "att_hd_miss", "att_hd_post", "att_hd_target",
  "att_hd_total", "att_ibox_blocked", "att_ibox_goal", "att_ibox_miss", "att_ibox_post", "att_ibox_target", "att_lf_goal",
  "att_lf_target", "att_lf_total", "att_lg_centre", "att_lg_left", "att_lg_right", "att_miss_high", "att_miss_high_left",
  "att_miss_high_right", "att_miss_left", "att_miss_right", "att_obox_blocked", "att_obox_goal", "att_obox_miss",
  "att_obox_post", "att_obox_target", "att_obp_goal", "att_obx_centre", "att_obx_left", "att_obx_right", "att_obxd_left",
  "att_obxd_right", "att_one_on_one", "att_openplay", "att_pen_post", "att_pen_target", "att_post_high", "att_post_left",
  "att_post_right", "att_rf_goal", "att_rf_target", "att_rf_total", "att_setpiece", "att_sv_high_centre", "att_sv_high_left",
  "att_sv_high_right", "att_sv_low_centre", "att_sv_low_left", "att_sv_low_right", "attempted_tackle_foul",
  "attempts_conceded_ibox", "attempts_conceded_obox", "attempts_ibox", "attempts_obox", "big_chance_saves", "big_chance_scored",
  "blocked_cross", "blocked_pass", "carries", "clearance_off_line", "clearances_blocks_interceptions", "corner_taken",
  "creativity", "cross_not_claimed", "crosses_18yard", "crosses_18yardplus", "dangerous_play", "defensive_contribution",
  "dive_catch", "dive_save", "diving_save", "draws", "effective_blocked_cross", "effective_clearance",
  "effective_head_clearance", "expected_assists", "expected_goal_involvements", "expected_goals_conceded", "final_third_entries",
  "final_third_entries_open_play", "foul_throw_in", "fouled_final_third", "freekick_cross", "fwd_pass", "game_started",
  "gk_smother", "goal_assist_deadball", "goal_assist_intentional", "goal_assist_openplay", "goal_assist_setplay",
  "goal_fastbreak", "goal_kicks", "goals_conceded_ibox", "goals_conceded_obox", "goals_openplay", "hand_ball", "head_clearance",
  "head_pass", "ict_index", "influence", "interception_won", "interceptions_in_box", "keeper_pick_up", "keeper_throws",
  "leftside_pass", "long_pass_own_to_opp", "long_pass_own_to_opp_success", "losses", "lost_corners", "offside_provoked",
  "offtarget_att_assist", "ontarget_att_assist", "open_play_pass", "overrun", "own_goals_conceded", "passes_left",
  "passes_right", "pen_area_entries", "pen_area_entries_open_play", "pen_goals_conceded", "penalty_faced", "poss_lost_ctrl",
  "poss_won_att_3rd", "poss_won_def_3rd", "poss_won_mid_3rd", "post_scoring_att", "progressive_carries", "put_through",
  "rightside_pass", "saved_obox", "second_goal_assist", "shield_ball_oop", "shot_created", "shot_fastbreak", "six_yard_block",
  "stand_catch", "stand_save", "successful_final_third_entries", "successful_final_third_entries_open_play",
  "successful_final_third_passes", "successful_open_play_pass", "successful_pen_area_entries",
  "successful_pen_area_entries_open_play", "successful_put_through", "threat", "times_tackled", "total_back_zone_pass",
  "total_chipped_pass", "total_corners_intobox", "total_cross_nocorner", "total_fastbreak", "total_final_third_passes",
  "total_flick_on", "total_fwd_zone_pass", "total_high_claim", "total_keeper_sweeper", "total_launches", "total_layoffs",
  "total_pull_back", "total_sub_off", "total_sub_on", "total_throws", "touches_in_final_third", "touches_in_opp_box", "turnover",
  "unsuccessful_touch", "winning_goal", "wins", "won_corners",
];

/** The one table: every catalogue stat's decision, its Sportmonks type id or `MISSING`. */
export const SPORTMONKS_STAT_TYPES: Readonly<Record<string, number | typeof MISSING>> = {
  ...SPORTMONKS_STAT_IDS,
  ...Object.fromEntries(NOT_IN_SPORTMONKS.map((stat) => [stat, MISSING])),
};
