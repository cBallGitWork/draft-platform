import type { RoleAdjustments } from "./scoringSet";

// Claude's first draft of each role's adjustment (spec/05 Roles; Craig, 26 Oct 2026: "Claude
// drafts the first numbers; Craig edits them later, by patch"). Every role gives something and
// takes something, flat points per action. They aren't in any scoring set: the admin puts them in
// a patch, announced a week ahead like any change (spec/14), so no gameweek's points move until
// then. Unbalanced until #457 checks them against last season.

const adjust = (role: string, ...adjustments: [stat: string, points: number][]): RoleAdjustments => ({
  role,
  adjustments: adjustments.map(([stat, points]) => ({ stat, points })),
});

export const DRAFTED_ROLE_ADJUSTMENTS: readonly RoleAdjustments[] = [
  adjust("shotStopper", ["saves", 0.5], ["accurate_long_balls", -0.5]),
  adjust("sweeperKeeper", ["accurate_long_balls", 0.5], ["saves", -0.5]),
  adjust("defensiveFullBack", ["clearances_blocks_interceptions", 0.5], ["accurate_cross", -0.5]),
  adjust("attackingFullBack", ["accurate_cross", 1], ["clean_sheets", -1]),
  adjust("stopper", ["effective_clearance", 0.5], ["accurate_long_balls", -0.5]),
  adjust("ballPlayingDefender", ["accurate_long_balls", 0.5], ["effective_clearance", -0.5]),
  adjust("sweeper", ["clearances_blocks_interceptions", 0.5], ["aerial_won", -0.5]),
  adjust("libero", ["big_chance_created", 1], ["clean_sheets", -1]),
  adjust("attackingWingBack", ["accurate_cross", 1], ["clean_sheets", -1]),
  adjust("holdingWingBack", ["won_tackle", 0.5], ["accurate_cross", -0.5]),
  adjust("anchor", ["won_tackle", 0.5], ["total_scoring_att", -0.5]),
  adjust("deepPlaymaker", ["accurate_long_balls", 0.5], ["won_tackle", -0.5]),
  adjust("wideMidfielder", ["accurate_cross", 1], ["won_tackle", -0.5]),
  adjust("defensiveWinger", ["won_tackle", 0.5], ["accurate_cross", -0.5]),
  adjust("boxToBox", ["total_scoring_att", 0.5], ["dispossessed", -0.5]),
  adjust("playmaker", ["big_chance_created", 1], ["won_tackle", -0.5]),
  adjust("ballWinner", ["won_tackle", 0.5], ["big_chance_created", -1]),
  adjust("insideForward", ["total_scoring_att", 0.5], ["accurate_cross", -0.5]),
  adjust("winger", ["accurate_cross", 1], ["total_scoring_att", -0.5]),
  adjust("numberTen", ["big_chance_created", 1], ["total_scoring_att", -0.5]),
  adjust("shadowStriker", ["goals_scored", 1], ["big_chance_created", -1]),
  adjust("poacher", ["goals_scored", 1], ["total_scoring_att", -0.5]),
  adjust("targetMan", ["aerial_won", 0.5], ["total_scoring_att", -0.5]),
  adjust("pressingForward", ["won_tackle", 1], ["goals_scored", -1]),
  adjust("falseNine", ["big_chance_created", 1], ["goals_scored", -1]),
];
