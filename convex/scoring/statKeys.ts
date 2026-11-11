// The stats the site's starting values name (firstScoring.ts, draftedRoleAdjustments.ts,
// draftedInstructionScoring.ts) and the back line reprices (teamScoring.ts), each typed once (#1574).
// A catalogue key is the name the feed fills (statCatalogueList.ts); a key starting
// OWN_STAT_PREFIX is one of the roles' own stats (FIRST_ROLE_OWN_STATS). A rule's stat is data:
// these only name the ones the code starts from.

import { OWN_STAT_PREFIX } from "./statCatalogue";

export { MINUTES_STAT } from "../stats/matchRecords";

/** FPL's 60 minutes: playing them is worth 2, and a clean sheet counts only for a player on that
 *  long, in base scoring and in Park the bus alike. */
export const CLEAN_SHEET_MINUTES = 60;

export const GOALS = "goals_scored";
export const ASSISTS = "assists";
export const CLEAN_SHEETS = "clean_sheets";
export const GOALS_CONCEDED = "goals_conceded";
export const SHOTS = "total_scoring_att";
export const SHOTS_ON_TARGET = "ontarget_scoring_att";
export const BIG_CHANCES_MISSED = "big_chance_missed";
export const BIG_CHANCES_CREATED = "big_chance_created";
export const KEY_PASSES = "total_att_assist";
export const THROUGH_BALLS = "accurate_through_ball";
export const PASSES = "total_pass";
export const ACCURATE_PASSES = "accurate_pass";
export const ACCURATE_LONG_BALLS = "accurate_long_balls";
export const LONG_BALLS = "total_long_balls";
export const ACCURATE_CROSSES = "accurate_cross";
export const CROSSES = "total_cross";
export const LAUNCHES = "total_launches";
export const ACCURATE_LAUNCHES = "accurate_launches";
export const DRIBBLES_WON = "won_contest";
export const FOULS_DRAWN = "was_fouled";
export const DUELS_WON = "duel_won";
export const AERIALS_WON = "aerial_won";
export const AERIALS_LOST = "aerial_lost";
export const TACKLES = "total_tackle";
export const TACKLES_WON = "won_tackle";
export const LAST_MAN_TACKLES = "last_man_tackle";
export const INTERCEPTIONS = "interception";
export const RECOVERIES = "ball_recovery";
export const CLEARANCES = "total_clearance";
export const BLOCKS = "outfielder_block";
export const SAVES = "saves";
export const SAVES_INSIDE_THE_BOX = "saved_ibox";
export const PENALTIES_SAVED = "penalties_saved";
export const HIGH_CLAIMS = "good_high_claim";
export const PUNCHES = "punches";
export const OFFSIDES = "total_offside";
export const FOULS = "fouls";
export const YELLOW_CARDS = "yellow_cards";
export const RED_CARDS = "red_cards";
export const DISPOSSESSED = "dispossessed";
export const POSSESSION_LOST = "poss_lost_all";
export const DRIBBLED_PAST = "challenge_lost";
export const SHOTS_OFF_TARGET = "shot_off_target";
export const ERRORS_TO_A_SHOT = "error_lead_to_shot";
export const ERRORS_TO_A_GOAL = "error_lead_to_goal";

// The roles' own stats.
export const FAILED_LONG_BALLS = `${OWN_STAT_PREFIX}failed_long_balls` as const;
export const FAILED_CROSSES = `${OWN_STAT_PREFIX}failed_crosses` as const;
export const MISPLACED_PASSES = `${OWN_STAT_PREFIX}misplaced_passes` as const;
export const FAILED_LAUNCHES = `${OWN_STAT_PREFIX}failed_launches` as const;
export const GROUND_DUELS_WON = `${OWN_STAT_PREFIX}ground_duels_won` as const;
