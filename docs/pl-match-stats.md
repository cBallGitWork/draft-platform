# The Premier League's stats per player per match

What roles can score from (issue #7, story 4; [spec/05-tactics.md](../spec/05-tactics.md)). Read
from Convex's own servers is proven for the feeds in [ARCHITECTURE.md](../ARCHITECTURE.md); this
list was read from the same API on 19 Oct 2026.

**Where:** `GET https://footballapi.pulselive.com/football/stats/player/{plPlayerId}?fixtures={fixtureId}`,
with a browser User-Agent. It answers one player's Opta stats for that one match: Daniel Muñoz at
Forest v Arsenal (fixture 128991) shows `appearances` 1 and `mins_played` 90, against 6 and 439
for his season. A match's players and their ids come from `GET /fixtures/{fixtureId}` (`teamLists`).

**Read with care:**

- A stat is missing, not zero, when a player didn't do it. Missing means 0.
- These 221 names are every one seen across the 120 players in three matches of 18 Oct 2026, so
  rare events may exist that didn't happen there (a red card, a penalty save, an error leading to a
  goal). The list is what is certain, not everything.
- There is no xG or xA.

## The ones the tactics spec names

| Spec | Stat |
|---|---|
| Key passes | `total_att_assist` (Opta's key pass: a pass that ends in a shot) |
| Crosses | `total_cross`, `accurate_cross` |
| Aerials | `aerial_won`, `aerial_lost` |
| Dribbles | `won_contest` of `total_contest` |
| Sweeper actions | `total_keeper_sweeper`, `accurate_keeper_sweeper` |
| Punches | `punches` |
| High claims | `good_high_claim` of `total_high_claim` |
| Long balls | `accurate_long_balls` of `total_long_balls` |

## All 221, by area

**Keeping (27):** saves, saved_ibox, saved_obox, dive_save, diving_save, big_chance_saves,
gk_smother, punches, good_high_claim, total_high_claim, keeper_pick_up, total_keeper_sweeper,
accurate_keeper_sweeper, goal_kicks, accurate_goal_kicks, keeper_throws, accurate_keeper_throws,
total_launches, accurate_launches, total_chipped_pass, accurate_chipped_pass, clean_sheet,
goals_conceded, goals_conceded_ibox, goals_conceded_obox, attempts_conceded_ibox,
attempts_conceded_obox. Outfielders carry the last five too.

**Shooting (67):** goals, goals_openplay, goal_fastbreak, winning_goal, own_goals,
own_goals_conceded, total_scoring_att, ontarget_scoring_att, shot_off_target, blocked_scoring_att,
post_scoring_att, hit_woodwork, big_chance_scored, big_chance_missed, attempts_ibox, attempts_obox,
att_openplay, att_setpiece, att_corner, att_fastbreak, shot_fastbreak, total_fastbreak,
att_freekick_total, att_freekick_miss; by foot and head: att_lf_total, att_lf_target, att_lf_goal,
att_rf_total, att_rf_target, att_rf_goal, att_hd_total, att_hd_target, att_hd_miss, att_hd_post;
by where it was taken: att_ibox_goal, att_ibox_target, att_ibox_miss, att_ibox_blocked,
att_ibox_post, att_obox_goal, att_obox_target, att_obox_miss, att_obox_blocked, att_bx_centre,
att_bx_left, att_bx_right, att_obx_centre, att_lg_centre; by where it went (19): att_goal_*,
att_sv_*, att_miss_*, att_cmiss_*, att_post_*.

**Chance creation (19):** goal_assist, goal_assist_openplay, goal_assist_setplay,
goal_assist_intentional, second_goal_assist, assist_own_goal, total_att_assist, att_assist_openplay,
att_assist_setplay, ontarget_att_assist, offtarget_att_assist, assist_attempt_saved,
assist_blocked_shot, big_chance_created, shot_created, total_through_ball, accurate_through_ball,
put_through, successful_put_through.

**Crossing (17):** total_cross, accurate_cross, total_cross_nocorner, accurate_cross_nocorner,
crosses_18yard, crosses_18yardplus, blocked_cross, effective_blocked_cross, freekick_cross,
accurate_freekick_cross, total_pull_back, accurate_pull_back, corner_taken, total_corners_intobox,
accurate_corners_intobox, won_corners, lost_corners.

**Passing (36):** total_pass, accurate_pass, open_play_pass, successful_open_play_pass, fwd_pass,
backward_pass, leftside_pass, rightside_pass, passes_left, passes_right, head_pass, blocked_pass,
total_long_balls, accurate_long_balls, long_pass_own_to_opp, long_pass_own_to_opp_success,
total_fwd_zone_pass, accurate_fwd_zone_pass, total_back_zone_pass, accurate_back_zone_pass,
total_final_third_passes, successful_final_third_passes, final_third_entries,
successful_final_third_entries, final_third_entries_open_play,
successful_final_third_entries_open_play, pen_area_entries, successful_pen_area_entries,
pen_area_entries_open_play, successful_pen_area_entries_open_play, total_flick_on,
accurate_flick_on, total_layoffs, accurate_layoffs, total_throws, accurate_throws.

**On the ball (15):** touches, touches_in_final_third, touches_in_opp_box, carries,
progressive_carries, total_contest, won_contest, overrun, dispossessed, times_tackled, turnover,
unsuccessful_touch, poss_lost_all, poss_lost_ctrl, shield_ball_oop.

**Defending (20):** total_tackle, won_tackle, last_man_tackle, attempted_tackle_foul,
challenge_lost, interception, interception_won, interceptions_in_box, ball_recovery,
poss_won_def_3rd, poss_won_mid_3rd, poss_won_att_3rd, total_clearance, effective_clearance,
head_clearance, effective_head_clearance, clearance_off_line, outfielder_block, six_yard_block,
offside_provoked.

**Duels (4):** duel_won, duel_lost, aerial_won, aerial_lost.

**Discipline (7):** fouls, was_fouled, fouled_final_third, yellow_card, hand_ball, total_offside,
error_lead_to_shot.

**Time on pitch (9):** appearances, game_started, mins_played, total_sub_on, total_sub_off,
formation_place, wins, draws, losses.
