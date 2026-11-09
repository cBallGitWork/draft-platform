// Where each catalogue stat comes from in a past season's log (#842; spec/14, The rule balance
// lab). ai-carling-premiership's player match log holds FPL's, SofaScore's, FotMob's and
// Understat's columns, not the Premier League's own, so each stat takes its nearest column, and
// one with none is "not tested" in the lab and the patch notes. Craig, 6 Nov 2026, on #842:
// - one feed per stat, in this order: FPL, then SofaScore, FotMob, Understat;
// - only the stats the site scores now are copied, so every other stat is "not tested" until its
//   column is added here and the copy (scripts/past-season.mjs) is run again on Craig's Mac.
// Craig, 7 Nov 2026, on #10: each role stat takes its nearest past column, else "not tested". A
// column is nearest when it counts the same action, perhaps a little wider (SofaScore's crosses
// include corners, its clearances every clearance, not only the effective ones). A column that
// counts something else (metres carried for progressive carries) is no column, and no two stats
// share one, so a stat whose nearest column another stat already takes stays "not tested".
// Every catalogue stat is in exactly one of the two lists (pastStatColumns.test.ts), so a stat new
// to the catalogue waits on a decision here. Pure, with no runtime imports, so the script reads it
// in plain Node.

/** The feeds the log holds, in the order a stat takes its column. `ai-carling` is a column the log
 *  gives with no feed's prefix. */
export const PAST_FEEDS = ["FPL", "SofaScore", "FotMob", "Understat", "ai-carling"] as const;
export type PastFeed = (typeof PAST_FEEDS)[number];

/** The feeds that leave a stat out of the log when it is 0, each by the column that says the feed
 *  covered his match (its minutes). SofaScore never writes a 0 and FotMob writes few (checked over
 *  2021/22 to 2025/26's played rows, 9 Nov 2026), so where the feed covered his match a missing
 *  stat of its own is a 0; where it didn't, the stat stays absent. */
export const ZERO_LEFT_OUT_BY: Readonly<Partial<Record<PastFeed, string>>> = {
  SofaScore: "sofascore_minutes",
  FotMob: "fotmob_minutes",
};

/** A stat's column in the log, and its feed, for the patch notes ("tested on FPL's saves"). */
export interface PastColumn {
  feed: PastFeed;
  column: string;
}

/** Each stat the copy keeps, by our name (matchRecords.ts), from its column: every stat the first
 *  scoring set prices (firstScoring.ts), and defensive contribution, which #1113 keeps for its
 *  re-score check against FPL's own points. */
export const PAST_STAT_COLUMNS: Readonly<Record<string, PastColumn>> = {
  minutes: { feed: "FPL", column: "fpl_minutes" },
  goals_scored: { feed: "ai-carling", column: "goals" },
  assists: { feed: "FPL", column: "assists_fpl" },
  clean_sheets: { feed: "FPL", column: "fpl_clean_sheets" },
  goals_conceded: { feed: "FPL", column: "fpl_goals_conceded" },
  saves: { feed: "FPL", column: "fpl_saves" },
  penalties_saved: { feed: "FPL", column: "fpl_penalties_saved" },
  penalties_missed: { feed: "FPL", column: "fpl_penalties_missed" },
  defensive_contribution: { feed: "FPL", column: "fpl_defensive_contribution" },
  yellow_cards: { feed: "ai-carling", column: "yellow_cards" },
  red_cards: { feed: "ai-carling", column: "red_cards" },
  own_goals: { feed: "FPL", column: "fpl_own_goals" },
  // The roles' stats (#10).
  accurate_cross: { feed: "SofaScore", column: "sofascore_accurate_crosses" },
  total_cross: { feed: "SofaScore", column: "sofascore_crosses_attempted" },
  accurate_long_balls: { feed: "SofaScore", column: "sofascore_long_balls_accurate" },
  total_long_balls: { feed: "SofaScore", column: "sofascore_long_balls_attempted" },
  accurate_pass: { feed: "SofaScore", column: "sofascore_accurate_passes" },
  total_pass: { feed: "SofaScore", column: "sofascore_passes_attempted" },
  aerial_won: { feed: "SofaScore", column: "sofascore_aerial_won" },
  aerial_lost: { feed: "SofaScore", column: "sofascore_aerial_lost" },
  ball_recovery: { feed: "SofaScore", column: "recoveries" },
  big_chance_created: { feed: "SofaScore", column: "sofascore_big_chances_created" },
  big_chance_missed: { feed: "SofaScore", column: "sofascore_big_chances_missed" },
  dispossessed: { feed: "SofaScore", column: "sofascore_dispossessed" },
  duel_won: { feed: "SofaScore", column: "sofascore_duel_won" },
  effective_clearance: { feed: "SofaScore", column: "clearances" },
  error_lead_to_shot: { feed: "SofaScore", column: "sofascore_error_lead_to_shot" },
  fouls: { feed: "SofaScore", column: "fouls_committed" },
  good_high_claim: { feed: "SofaScore", column: "sofascore_good_high_claim" },
  interception: { feed: "SofaScore", column: "interceptions" },
  ontarget_scoring_att: { feed: "SofaScore", column: "shots_on_target" },
  outfielder_block: { feed: "SofaScore", column: "blocks" },
  punches: { feed: "SofaScore", column: "sofascore_punches" },
  total_att_assist: { feed: "SofaScore", column: "sofascore_key_passes" },
  total_tackle: { feed: "SofaScore", column: "tackles" },
  was_fouled: { feed: "SofaScore", column: "fouls_won" },
  won_tackle: { feed: "SofaScore", column: "sofascore_won_tackle" },
  accurate_keeper_sweeper: { feed: "FotMob", column: "fotmob_keeper_sweeper_actions" },
  clearance_off_line: { feed: "FotMob", column: "saved_off_line" },
  successful_final_third_passes: { feed: "FotMob", column: "passes_into_final_third" },
  touches_in_opp_box: { feed: "FotMob", column: "touches_opp_box" },
  won_contest: { feed: "FotMob", column: "successful_dribbles" },
  // Opta's challenge lost is being dribbled past.
  challenge_lost: { feed: "FotMob", column: "fotmob_dribbled_past" },
};

/** Every other catalogue stat: not copied, so "not tested" in the lab. */
export const NOT_TESTED: readonly string[] = [
  "accurate_back_zone_pass", "accurate_chipped_pass", "accurate_corners_intobox", "accurate_cross_nocorner",
  "accurate_flick_on", "accurate_freekick_cross", "accurate_fwd_zone_pass", "accurate_goal_kicks", "accurate_keeper_throws",
  "accurate_launches", "accurate_layoffs", "accurate_pull_back", "accurate_through_ball", "accurate_throws", "appearances",
  "assist_attempt_saved", "assist_blocked_shot", "assist_free_kick_won", "assist_handball_won", "assist_own_goal",
  "assist_pass_lost", "assist_penalty_won", "assist_post", "att_assist_openplay", "att_assist_setplay", "att_bx_centre",
  "att_bx_left", "att_bx_right", "att_cmiss_high", "att_cmiss_high_left", "att_cmiss_high_right", "att_cmiss_left",
  "att_cmiss_right", "att_corner", "att_fastbreak", "att_freekick_goal", "att_freekick_miss", "att_freekick_post",
  "att_freekick_target", "att_freekick_total", "att_goal_high_centre", "att_goal_high_left", "att_goal_high_right",
  "att_goal_low_centre", "att_goal_low_left", "att_goal_low_right", "att_hd_goal", "att_hd_miss", "att_hd_post",
  "att_hd_target", "att_hd_total", "att_ibox_blocked", "att_ibox_goal", "att_ibox_miss", "att_ibox_post", "att_ibox_target",
  "att_lf_goal", "att_lf_target", "att_lf_total", "att_lg_centre", "att_lg_left", "att_lg_right", "att_miss_high",
  "att_miss_high_left", "att_miss_high_right", "att_miss_left", "att_miss_right", "att_obox_blocked", "att_obox_goal",
  "att_obox_miss", "att_obox_post", "att_obox_target", "att_obp_goal", "att_obx_centre", "att_obx_left", "att_obx_right",
  "att_obxd_left", "att_obxd_right", "att_one_on_one", "att_openplay", "att_pen_goal", "att_pen_post", "att_pen_target",
  "att_post_high", "att_post_left", "att_post_right", "att_rf_goal", "att_rf_target", "att_rf_total", "att_setpiece",
  "att_sv_high_centre", "att_sv_high_left", "att_sv_high_right", "att_sv_low_centre", "att_sv_low_left", "att_sv_low_right",
  "attempted_tackle_foul", "attempts_conceded_ibox", "attempts_conceded_obox", "attempts_ibox", "attempts_obox",
  "backward_pass", "big_chance_saves", "big_chance_scored", "blocked_cross", "blocked_pass", "blocked_scoring_att",
  "carries", "clearances_blocks_interceptions", "corner_taken", "creativity", "cross_not_claimed",
  "crosses_18yard", "crosses_18yardplus", "dangerous_play", "dive_catch", "dive_save", "diving_save", "draws", "duel_lost",
  "effective_blocked_cross", "effective_head_clearance", "error_lead_to_goal", "expected_assists",
  "expected_goal_involvements", "expected_goals", "expected_goals_conceded", "final_third_entries",
  "final_third_entries_open_play", "foul_throw_in", "fouled_final_third", "freekick_cross", "fwd_pass", "game_started",
  "gk_smother", "goal_assist_deadball", "goal_assist_intentional", "goal_assist_openplay", "goal_assist_setplay",
  "goal_fastbreak", "goal_kicks", "goals_conceded_ibox", "goals_conceded_obox", "goals_openplay", "hand_ball",
  "head_clearance", "head_pass", "hit_woodwork", "ict_index", "influence", "interception_won", "interceptions_in_box",
  "keeper_pick_up", "keeper_throws", "last_man_tackle", "leftside_pass", "long_pass_own_to_opp",
  "long_pass_own_to_opp_success", "losses", "lost_corners", "offside_provoked", "offtarget_att_assist",
  "ontarget_att_assist", "open_play_pass", "overrun", "own_goals_conceded", "passes_left", "passes_right",
  "pen_area_entries", "pen_area_entries_open_play", "pen_goals_conceded", "penalty_conceded", "penalty_faced",
  "penalty_won", "poss_lost_all", "poss_lost_ctrl", "poss_won_att_3rd", "poss_won_def_3rd", "poss_won_mid_3rd",
  "post_scoring_att", "progressive_carries", "put_through", "recoveries", "rightside_pass", "saved_ibox", "saved_obox",
  "second_goal_assist", "second_yellow", "shield_ball_oop", "shot_created", "shot_fastbreak", "shot_off_target",
  "six_yard_block", "stand_catch", "stand_save", "successful_final_third_entries",
  "successful_final_third_entries_open_play", "successful_open_play_pass", "successful_pen_area_entries",
  "successful_pen_area_entries_open_play", "successful_put_through", "tackles", "threat", "times_tackled",
  "total_back_zone_pass", "total_chipped_pass", "total_clearance", "total_contest", "total_corners_intobox",
  "total_cross_nocorner", "total_fastbreak", "total_final_third_passes", "total_flick_on", "total_fwd_zone_pass",
  "total_high_claim", "total_keeper_sweeper", "total_launches", "total_layoffs", "total_offside", "total_pull_back",
  "total_scoring_att", "total_sub_off", "total_sub_on", "total_through_ball", "total_throws", "touches",
  "touches_in_final_third", "turnover", "unsuccessful_touch", "winning_goal", "wins", "won_corners",
];
