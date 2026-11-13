import { FIRST_SCORING } from "./firstScoring";
import type { StoredScoringSet } from "./scoringSetShape";
import {
  ACCURATE_CROSSES,
  ACCURATE_LAUNCHES,
  ACCURATE_LONG_BALLS,
  ACCURATE_PASSES,
  AERIALS_LOST,
  AERIALS_WON,
  BIG_CHANCES_CREATED,
  BIG_CHANCES_MISSED,
  BLOCKS,
  CLEARANCES,
  CROSSES,
  DISPOSSESSED,
  DRIBBLED_PAST,
  DRIBBLES_WON,
  DUELS_WON,
  ERRORS_TO_A_GOAL,
  ERRORS_TO_A_SHOT,
  FAILED_CROSSES,
  FAILED_LAUNCHES,
  FAILED_LONG_BALLS,
  FOULS,
  FOULS_DRAWN,
  GOALS,
  GROUND_DUELS_WON,
  HIGH_CLAIMS,
  INTERCEPTIONS,
  KEY_PASSES,
  LAST_MAN_TACKLES,
  LAUNCHES,
  LONG_BALLS,
  MISPLACED_PASSES,
  OFFSIDES,
  PASSES,
  PENALTIES_SAVED,
  POSSESSION_LOST,
  PUNCHES,
  RECOVERIES,
  SAVES,
  SAVES_INSIDE_THE_BOX,
  SHOTS,
  SHOTS_OFF_TARGET,
  SHOTS_ON_TARGET,
  TACKLES,
  TACKLES_WON,
  THROUGH_BALLS,
} from "./statKeys";

// The roles' values (spec/05 Roles; #10, #1445): docs/roles-first-values.md, the mixes redrawn
// around Sportmonks' stats on 9 and 10 Nov 2026 (#1196), as the site's scoring holds them. Each role
// scores a plain mix of what it is best at and loses for one bad action (`S05.27`). Every stat is a
// catalogue stat Sportmonks sends (football/sportmonks/sportmonksStats.ts), or an own stat made of
// them (`S05.28`): a test holds that. The bars are Claude's draft, each aimed at its slot's target
// role bonus a start (spec/05's table), and the backtest refits them (`S05.10`). This file is only
// where they start: they go into the site's set by firstRolesVersion.ts, and change by patch after.

type OwnStat = NonNullable<StoredScoringSet["ownStats"]>[number];
type RoleScoring = NonNullable<StoredScoringSet["roles"]>[number];
type RoleSide = RoleScoring["bonus"];

/** The page's counts the feed only sends as a total and a share of it: the total less the share.
 *  Failed launches no role scores now, but a set the first values went into holds it. */
export const FIRST_ROLE_OWN_STATS: readonly OwnStat[] = [
  less(FAILED_LONG_BALLS, "Failed long balls", "FLB", LONG_BALLS, ACCURATE_LONG_BALLS),
  less(FAILED_CROSSES, "Failed crosses", "FCR", CROSSES, ACCURATE_CROSSES),
  less(MISPLACED_PASSES, "Misplaced passes", "MPS", PASSES, ACCURATE_PASSES),
  less(FAILED_LAUNCHES, "Failed launches", "FLA", LAUNCHES, ACCURATE_LAUNCHES),
  // Duels won less aerials won (docs/roles-first-values.md, the ball-winner and the destroyer).
  less(GROUND_DUELS_WON, "Ground duels won", "GDW", DUELS_WON, AERIALS_WON),
];

function less(stat: string, name: string, shortCode: string, total: string, share: string): OwnStat {
  return { stat, name, shortCode, parts: [{ stat: total, weight: 1 }, { stat: share, weight: -1 }] };
}

/** A side: its three bars, then each stat with its weight (2 × goals is ["goals_scored", 2]). */
function side(bars: [number, number, number], ...parts: [stat: string, weight: number][]): RoleSide {
  return { bars, parts: parts.map(([stat, weight]) => ({ stat, weight })) };
}

const role = (key: string, bonus: RoleSide, cost: RoleSide): RoleScoring => ({ role: key, bonus, cost });

/** Every role of the default set (lineup/roles.ts), in the page's order. */
export const FIRST_ROLES: readonly RoleScoring[] = [
  // Strikers: +0.5 a start.
  role("poacher", side([2, 3, 4], [GOALS, 2], [SHOTS_ON_TARGET, 1]), side([1, 4, 7], [BIG_CHANCES_MISSED, 1])),
  role("targetMan", side([4, 6, 8], [AERIALS_WON, 1]), side([5, 8, 11], [AERIALS_LOST, 1])),
  role("inBehindStriker", side([2, 3, 5], [DRIBBLES_WON, 1], [FOULS_DRAWN, 1]), side([1, 2, 3], [OFFSIDES, 1])),
  role("pressingForward", side([3, 5, 7], [TACKLES_WON, 1], [INTERCEPTIONS, 1], [RECOVERIES, 1]), side([1, 4, 7], [FOULS, 1])),
  role("falseNine", side([3, 5, 7], [KEY_PASSES, 1], [THROUGH_BALLS, 1], [DRIBBLES_WON, 1], [ACCURATE_PASSES, 0.1]), side([1, 2, 3], [DISPOSSESSED, 1])),
  // Wingers (wide attacking midfield): +0.6 a start.
  role("winger", side([2, 4, 6], [ACCURATE_CROSSES, 1], [DRIBBLES_WON, 1]), side([2, 3, 4], [DISPOSSESSED, 1])),
  role("dribbler", side([3, 5, 7], [DRIBBLES_WON, 1], [FOULS_DRAWN, 1]), side([2, 4, 6], [DISPOSSESSED, 1])),
  role("insideForward", side([3, 5, 7], [SHOTS, 1], [SHOTS_ON_TARGET, 1], [GOALS, 2]), side([1, 2, 3], [BIG_CHANCES_MISSED, 1])),
  role("widePlaymaker", side([1, 2, 4], [KEY_PASSES, 1], [THROUGH_BALLS, 1], [BIG_CHANCES_CREATED, 1]), side([13, 16, 19], [POSSESSION_LOST, 1])),
  role("pressingWinger", side([3, 5, 7], [TACKLES_WON, 1], [RECOVERIES, 1]), side([1, 2, 3], [FOULS, 1])),
  role("trackingWinger", side([2, 3, 5], [TACKLES_WON, 1], [INTERCEPTIONS, 1], [BLOCKS, 1], [CLEARANCES, 1]), side([1, 2, 3], [DRIBBLED_PAST, 1])),
  // Attacking midfield, centre: +0.6 a start.
  role("numberTen", side([2, 4, 6], [KEY_PASSES, 1], [BIG_CHANCES_CREATED, 2], [THROUGH_BALLS, 1]), side([1, 2, 3], [SHOTS_OFF_TARGET, 1])),
  role("attackingMidfieldShadowStriker", side([3, 5, 7], [SHOTS, 1], [SHOTS_ON_TARGET, 1], [GOALS, 2]), side([1, 2, 3], [OFFSIDES, 1])),
  role("carrier", side([2, 4, 6], [DRIBBLES_WON, 1], [FOULS_DRAWN, 1]), side([1, 2, 3], [DISPOSSESSED, 1])),
  role("pressingTen", side([3, 4, 6], [TACKLES_WON, 1], [INTERCEPTIONS, 1], [RECOVERIES, 0.5]), side([2, 3, 4], [FOULS, 1])),
  // Wide midfield: +0.8 a start.
  role("wideMidfielder", side([3, 5, 7], [RECOVERIES, 0.5], [TACKLES, 1], [ACCURATE_CROSSES, 1]), side([1, 2, 3], [FOULS, 1])),
  role("defensiveWinger", side([2, 3, 4], [TACKLES, 1], [INTERCEPTIONS, 1], [BLOCKS, 1]), side([2, 3, 4], [DRIBBLED_PAST, 1])),
  role("wideMidfieldPlaymaker", side([2, 3, 4], [ACCURATE_LONG_BALLS, 1], [KEY_PASSES, 1]), side([4, 5, 6], [FAILED_LONG_BALLS, 1])),
  role("crosser", side([3, 4, 6], [ACCURATE_CROSSES, 1], [CROSSES, 0.5]), side([7, 10, 13], [FAILED_CROSSES, 1])),
  // Keepers: +0.9 a start.
  role("shotStopper", side([4, 6, 8], [SAVES, 1], [SAVES_INSIDE_THE_BOX, 1], [PENALTIES_SAVED, 3]), side([1, 2, 3], [ERRORS_TO_A_GOAL, 1])),
  role("sweeperKeeper", side([1, 2, 3], [INTERCEPTIONS, 1], [TACKLES_WON, 1], [LAST_MAN_TACKLES, 1], [CLEARANCES, 1]), side([1, 2, 3], [ERRORS_TO_A_SHOT, 1])),
  role("distributor", side([10, 12, 14], [ACCURATE_LONG_BALLS, 1], [ACCURATE_PASSES, 0.2]), side([9, 12, 15], [FAILED_LONG_BALLS, 1])),
  role("commandingKeeper", side([1, 2, 4], [HIGH_CLAIMS, 1], [PUNCHES, 1]), side([1, 2, 3], [AERIALS_LOST, 1])),
  // Central midfield: +1.0 a start.
  role("boxToBox", side([3, 5, 7], [RECOVERIES, 0.5], [TACKLES_WON, 1], [SHOTS, 1]), side([1, 3, 5], [DISPOSSESSED, 1])),
  role("ballWinner", side([4, 6, 8], [TACKLES_WON, 1], [INTERCEPTIONS, 1], [GROUND_DUELS_WON, 1]), side([1, 2, 3], [FOULS, 1])),
  role("attackingEight", side([1, 2, 4], [DRIBBLES_WON, 1], [KEY_PASSES, 1]), side([2, 3, 4], [DISPOSSESSED, 1])),
  role("midfieldEngine", side([8, 9, 10], [RECOVERIES, 1], [INTERCEPTIONS, 1], [ACCURATE_PASSES, 0.1]), side([2, 3, 4], [DRIBBLED_PAST, 1])),
  // Wing-backs: +1.0 a start.
  role("attackingWingBack", side([2, 3, 4], [ACCURATE_CROSSES, 1], [KEY_PASSES, 1], [DRIBBLES_WON, 1]), side([3, 4, 5], [DISPOSSESSED, 1])),
  role("holdingWingBack", side([3, 4, 5], [TACKLES_WON, 1], [INTERCEPTIONS, 1], [RECOVERIES, 0.5]), side([1, 4, 7], [DRIBBLED_PAST, 1])),
  role(
    "completeWingBack",
    side([3, 4, 5], [ACCURATE_CROSSES, 1], [DRIBBLES_WON, 1], [TACKLES_WON, 1], [INTERCEPTIONS, 1]),
    side([14, 17, 20], [POSSESSION_LOST, 1]),
  ),
  role("invertedWingBack", side([3, 4, 5], [ACCURATE_PASSES, 0.1], [KEY_PASSES, 1]), side([1, 2, 3], [FOULS, 1])),
  role("goalscoringWingBack", side([1, 2, 4], [SHOTS, 1], [SHOTS_ON_TARGET, 1], [GOALS, 2]), side([1, 2, 3], [BIG_CHANCES_MISSED, 1])),
  // Full-backs: +1.1 a start.
  role("overlappingFullBack", side([3, 4, 5], [ACCURATE_CROSSES, 2], [CROSSES, 1], [DRIBBLES_WON, 1]), side([1, 5, 9], [DISPOSSESSED, 1])),
  role("invertedFullBack", side([4, 5, 6], [ACCURATE_PASSES, 0.1]), side([11, 12, 13], [MISPLACED_PASSES, 1])),
  role("playmakingFullBack", side([2, 3, 4], [ACCURATE_LONG_BALLS, 1], [KEY_PASSES, 1]), side([2, 3, 4], [FAILED_LONG_BALLS, 1])),
  role("defensiveFullBack", side([5, 6, 7], [TACKLES_WON, 1], [INTERCEPTIONS, 1], [CLEARANCES, 1], [BLOCKS, 1]), side([3, 4, 5], [DRIBBLED_PAST, 1])),
  // Defensive midfield: +1.1 a start.
  role("metronome", side([4, 5, 6], [ACCURATE_PASSES, 0.1]), side([8, 9, 10], [MISPLACED_PASSES, 1])),
  role("quarterback", side([3, 4, 5], [ACCURATE_LONG_BALLS, 1]), side([6, 7, 8], [FAILED_LONG_BALLS, 1])),
  // The third centre-back, under the half-back's key, which saved lineups hold (lineup/roles.ts).
  role("halfBack", side([3, 5, 7], [CLEARANCES, 1], [BLOCKS, 1], [INTERCEPTIONS, 1]), side([1, 2, 3], [ERRORS_TO_A_SHOT, 1])),
  role("engine", side([10, 11, 12], [RECOVERIES, 1], [INTERCEPTIONS, 1], [ACCURATE_PASSES, 0.1]), side([3, 5, 7], [DRIBBLED_PAST, 1])),
  role("tower", side([2, 4, 6], [AERIALS_WON, 1]), side([2, 4, 6], [AERIALS_LOST, 1])),
  role("destroyer", side([5, 7, 9], [TACKLES_WON, 2], [GROUND_DUELS_WON, 1]), side([5, 6, 7], [FOULS, 1])),
  // Centre-backs: +1.2 a start.
  role("stopper", side([3, 4, 6], [TACKLES_WON, 1], [BLOCKS, 1], [AERIALS_WON, 1]), side([3, 4, 5], [DRIBBLED_PAST, 1])),
  role("ballPlayingDefender", side([6, 8, 10], [ACCURATE_LONG_BALLS, 1], [ACCURATE_PASSES, 0.1]), side([7, 8, 9], [FAILED_LONG_BALLS, 1])),
  role("noNonsenseCentreBack", side([7, 9, 11], [CLEARANCES, 1], [LONG_BALLS, 1]), side([1, 2, 3], [ERRORS_TO_A_SHOT, 1])),
  role("attackingCentreBack", side([2, 4, 6], [SHOTS, 2], [GOALS, 3]), side([1, 2, 3], [DISPOSSESSED, 1])),
  role("sweeper", side([5, 7, 9], [RECOVERIES, 1], [INTERCEPTIONS, 1], [LAST_MAN_TACKLES, 1]), side([1, 2, 3], [DRIBBLED_PAST, 1])),
  role("libero", side([4, 5, 6], [DRIBBLES_WON, 1], [ACCURATE_PASSES, 0.1]), side([1, 2, 3], [DISPOSSESSED, 1])),
];

/** The first scoring with these values in it, as firstRolesVersion.ts puts them into a new
 *  deployment's set: what the Tactics preview and its tests price a role card under (#848). */
export const FIRST_SCORING_WITH_ROLES: StoredScoringSet = { ...FIRST_SCORING, ownStats: [...FIRST_ROLE_OWN_STATS], roles: [...FIRST_ROLES] };
