# The Premier League's stats per player per match

**Contents:** [The ones the tactics spec names](#the-ones-the-tactics-spec-names) · [All 221, by area](#all-221-by-area) · [Matching the two feeds](#matching-the-two-feeds) · [FPL's stats per match](#fpls-stats-per-match) · [Where a man lined up](#where-a-man-lined-up) · [One record per player per match](#one-record-per-player-per-match) · [During a match](#during-a-match)

What roles can score from (issue #7, story 4; [spec/05-tactics.md](../spec/05-tactics.md)). Read
from Craig's Mac on 19 Oct 2026; the same host answers Convex's servers
([ARCHITECTURE.md](../ARCHITECTURE.md)).

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

The mapping is Claude's reading of Opta's names, not something the feed states; it is confirmed
when roles are grilled.

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
attempts_conceded_obox. Outfielders carry the last six too.

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

## Matching the two feeds

Checked on 20 Oct 2026 against the whole season's 380 fixtures and every man on gameweek 6's
twenty team sheets (#27; `convex/football/feedIds.ts`):

- A fixture's `altIds.opta` is `g` + FPL's fixture `code` (380 of 380). It comes only when the
  fixture list is read with `altIds=true`; the full fixture read carries it anyway. FPL's own
  `pulse_id` on a fixture is 0 on all 380, so it is no join.
- A man's `altIds.opta` equals FPL's `opta_code` (400 of 400), which is `p` + his `code` (668 of 668).
- A club's `altIds.opta` is `t` + FPL's club `code`, and FPL's `pulse_id` on a club is the Premier
  League's team id (20 of 20).
- Its numbers arrive written as decimals (`128978.0`), which JSON reads as whole numbers.
- Opta leaves most noughts out but not all: Lewie Coyle's line at Hull v Everton sends `winning_goal` 0.
- An unused substitute's read is not empty: it sends `formation_place` 0 and nothing else.

## FPL's stats per match

Never written down before; from gameweek 6 (`convex/football/fplLive.ts`, `tests/support/recorded/`):

- **`/event/{gw}/live/`**, per player: `explain`, one block per match he had, keyed by FPL's
  per-season fixture `id` (`/fixtures/` gives its `code`). Each block lists `{identifier, value,
  points, points_modification}` only for what moved his FPL points, plus `minutes`, which is always
  there, nought or not, so a block without it is read as one FPL has not filled in yet: it gives
  that man no FPL line, and his record waits. Seen: `minutes`, `goals_scored`, `assists`, `clean_sheets`,
  `goals_conceded`, `yellow_cards`, `red_cards`, `saves`, `bonus`, `defensive_contribution`; FPL's
  `element_stats` adds `own_goals`, `penalties_saved` and `penalties_missed` to its scoring set.
- The same player's `stats` are the gameweek's totals, 29 keys: the ten above and `own_goals`,
  `penalties_saved`, `penalties_missed`, `bps`, `influence`, `creativity`, `threat`, `ict_index`,
  `clearances_blocks_interceptions`, `recoveries`, `tackles`, `starts`, `expected_goals`,
  `expected_assists`, `expected_goal_involvements`, `expected_goals_conceded`, `total_points`,
  `in_dreamteam`, `played`. The expected four and the four indices arrive as decimal strings; the
  last two are true or false. With one match they are that match's; in a double gameweek FPL
  does not split them.
- **`/fixtures/`**, per match: `stats`, eleven identifiers, each a home and an away list of
  `{element, value}` with noughts left out: `goals_scored`, `assists`, `own_goals`,
  `penalties_saved`, `penalties_missed`, `yellow_cards`, `red_cards`, `saves`, `bonus`, `bps` (which
  can be negative) and `defensive_contribution`. These are per match even in a double gameweek, but
  there are no minutes among them.
- The two feeds differ on minutes: at Hull v Everton nine of the ten starters taken off have one
  minute fewer in FPL than in Opta's `mins_played` (Grealish 85 against 86); Gelhardt, off at 64,
  is 64 in both. The ten substitutes who came on agree; the eight unused have 0 in FPL and no
  `mins_played` in Opta.

## Where a man lined up

For #22, from twelve of gameweek 6's team sheets: seven 4-2-3-1, four 3-4-2-1 and one 5-4-1, with
Opta's `formation_place` read for the 44 starters of Hull v Everton and Palace v Forest
(`tests/convex/football/plMatchSlots.test.ts` pins it).

- `teamLists[].formation` is `{label, players}`, `players` the starters' ids in lines: the keeper
  first, then each line up the pitch, matching the label (`1-4-2-3-1`). It draws the eleven
  starters exactly; substitutes are not in it. Two exceptions in all 900 sheets of 2025/26 and
  2026/27 to 20 Oct 2026 ([positions.md](positions.md#the-team-sheets)): every "4-5-1" draws a
  4-3-2-1, and one sheet draws a man it lists on the bench.
- Along a line the ids run from the side's own right to its left: every back four starts with its
  right back and ends with its left back, and every 3-4-2-1 midfield starts with the right wing-back.
- `formation_place` agrees with it: within one formation, a line and place always gives the same
  number, Opta's usual 1 to 11. Line by line, as the sheet draws them:
  - 4-2-3-1: 1 · 2 5 6 3 · 8 4 · 7 10 11 · 9
  - 3-4-2-1: 1 · 6 5 4 · 2 7 8 3 · 10 11 · 9
  - 5-4-1: 1 · 2 6 5 4 3 · 7 8 10 11 · 9
- A substitute's `formation_place` is 0, whether he came on or not, so neither source says where a
  substitute played.
- `matchPosition` (`G`, `D`, `M`, `F`) is the line he was named in; a 3-4-2-1's two behind the
  striker are `F`. The sheet's `info.positionInfo` ("Left Full Back") is his usual position, not
  this match's: Myles Lewis-Skelly, "Left Full Back", started in Arsenal's midfield two.

## One record per player per match

How #27 merges the two feeds (spec/07 "Match stats"; `convex/stats/matchRecords.ts` holds the pairs):

- Where both send a stat, FPL's count is kept for goals, assists, minutes, cards, saves, clean
  sheets, goals conceded and penalties, under FPL's name (`goals_scored`, not Opta's `goals`);
  Opta's for own goals and starts. Every other stat keeps its own feed's name.
- None of the three matches the 221 names come from had a red card, a penalty saved or a penalty
  missed, so Opta's names for them (`red_card`, `penalty_save`, `att_pen_miss`) are its usual
  ones, not yet seen here.
- Not paired, since neither feed says they count the same: FPL's `tackles` and `recoveries`
  beside Opta's `total_tackle`, `won_tackle` and `ball_recovery`. Both are kept.
- FPL's `bonus`, `bps`, `total_points` and `in_dreamteam` are never stored.
- Full time is the Premier League's fixture `status` "C"; the window runs from the first read that
  finds it.

## During a match

How #28 reads a match while it is played (`convex/stats/liveStatsSync.ts`, `convex/stats/liveStats.ts`):

- Every minute from kickoff, both feeds are read for each match being played, the same reads as
  at full time, and each record is written provisional. From the first read the Premier League
  calls full time, the match goes through the full-time path above; it stops being polled once
  complete, or four hours after kickoff.
- `changed` on each tick's row (`liveStatsTicks`) and each sync's (`matchStatsSyncs`) names the
  men whose records moved. Each league's scoring set is stored (#120), but no lineup is yet (#8)
  and nothing recomputes points from them, so none are; once something does, it recomputes them
  for those men.
- Seen live (23 Oct 2026, Ipswich v Nott'm Forest): a match in play's `status` is "L", then "C"
  at full time. The records filled in during play: the 22 starters' minutes moved each minute,
  and both goals, the assist and Diop's yellow card reached the men's records within a few
  minutes. Full time was seen the minute it came, at the tick that made all 40 records
  complete. 119 ticks, one a minute, none failed.

**The replay the tests use is not a live recording.** `tests/support/convex/liveStats.harness.ts` cuts Hull v
Everton, recorded finished, into a stage a minute: each man's stats grow with his share of his
minutes on the pitch, and goals, assists and yellow cards land at the minutes the fixture's
`events` give them. The 23 Oct 2026 recording (#37: Ipswich v Nott'm Forest, Premier League fixture
128999, by `scripts/record-match.mjs`) reads the commentary, the fixture and the team stats, not
the per-man stats or FPL's live read. To replay it instead, extend that script to save, each poll,
FPL's `/event/{gw}/live/` and each named man's `/stats/player/{id}?fixtures=128999` for a later
match, then swap `stagedGw6(minute)` for that match's poll nearest each minute.
