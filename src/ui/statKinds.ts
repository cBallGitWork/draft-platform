// The kinds the stat box groups the catalogue's unscored stats under (spec/19, `S19.5`): each stat
// by its key, the first kind whose pattern it matches, in the patterns' order, so a goal kick is
// goalkeeping before its "goal" reads as attacking. A stat the feeds start sending lands in the
// first it matches, or in other when none does. The catalogue's names are placeholders until
// Craig refines them (spec/14, `S14.17`); the kinds go by the keys, which never change.

import type { CatalogueStat } from "../../convex/scoring/statCatalogueList";
import { statKindWords } from "../shared/words";

type StatKind = keyof typeof statKindWords;
/** The kinds, in the order the stat box shows them: their words' order. */
const STAT_KINDS = Object.keys(statKindWords) as StatKind[];

/** The patterns, tried in this order. */
const KIND_PATTERNS: readonly (readonly [StatKind, RegExp])[] = [
  // A shooter's shots blocked, and the man tackled, before defending's "block" and "tackle".
  ["attacking", /^att_|blocked_scoring_att|assist_blocked_shot/],
  ["other", /times_tackled|shield_ball/],
  ["discipline", /card|yellow|foul|hand_ball|dangerous_play|penalty_conceded|offside(?!_provoked)/],
  [
    "goalkeeping",
    /^(saves|saved_|dive_|diving_|stand_|keeper_|accurate_keeper|total_keeper|gk_|punches|good_high_claim|total_high_claim|cross_not_claimed|penalty_faced|penalties_saved|big_chance_saves|accurate_goal_kicks|goal_kicks)/,
  ],
  [
    "defending",
    /tackle|interception|clearance|block|recovery|recoveries|aerial|duel|challenge_lost|poss_won|clean_sheet|conceded|error_lead|offside_provoked|defensive|own_goals|clearance_off_line/,
  ],
  [
    "attacking",
    /attempts_ibox|attempts_obox|goal|assist|scoring_att|shot|big_chance|expected_|penalty_won|penalties_missed|woodwork|won_contest|touches_in_opp_box|pen_area_entries|threat|one_on_one|fastbreak/,
  ],
  ["passing", /pass|cross|ball|launches|chipped|flick|layoff|corner|throw|pull_back|final_third|put_through|creativity|carries/],
];

/** The kind `stat` is grouped under. */
function kindOf(stat: string): StatKind {
  return KIND_PATTERNS.find(([, pattern]) => pattern.test(stat))?.[0] ?? "other";
}

/** `stats` by kind, each named by its words, the kinds in order and only those holding any, each
 *  stat in the order given. */
export function byKind(stats: readonly CatalogueStat[]): { name: string; stats: CatalogueStat[] }[] {
  return STAT_KINDS.map((kind) => ({ name: statKindWords[kind], stats: stats.filter((each) => kindOf(each.stat) === kind) })).filter(
    (group) => group.stats.length > 0,
  );
}
