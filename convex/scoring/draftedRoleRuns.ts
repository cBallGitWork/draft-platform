import type { StoredScoringSet } from "./scoringSetShape";

/** A run as the stored set holds it: scoringSet.ts's RoleRun. */
type RoleRun = NonNullable<StoredScoringSet["runs"]>[number];

// Each moving role's first run (spec/05 Runs; #846, #962; Craig, 31 Oct 2026), researched role by
// role in docs/role-runs.md. Held in the site's scoring set beside the roles' scoring, so an
// announced patch can change one (spec/05 `S05.8`; Craig, 7 Nov 2026, on #886: "Yes change role
// arrow allowed"): these are only what firstRolesVersion.ts's addFirstRuns puts into the set once.
// A role not listed holds its place.

/** A run through these points, each [forward, across] in metres from his place. The pitch's rows
 *  are 17.5 m apart, from his own goal line to theirs: the goalkeeper's middle is 96 m from their
 *  goal line, a defender's 79 m, a defensive midfielder's 61 m, a midfielder's 44 m, an attacking
 *  midfielder's 26 m and a striker's 9 m; their box's edge is 16.5 m out. A run straight up or
 *  down ends where two rows meet (9 m, 26.5 m from his place), so its arrowhead shows between two
 *  rows' players, not under one. */
const runOf = (role: string, ...points: [forward: number, across: number][]): RoleRun => ({
  role,
  path: points.map(([forward, across]) => ({ forward, across })),
});

/** The roles' first runs, in the default set's order (lineup/roles.ts). */
export const FIRST_RUNS: readonly RoleRun[] = [
  runOf("sweeperKeeper", [9, 0]),
  runOf("overlappingFullBack", [22, -1], [60, -3]),
  runOf("invertedFullBack", [12, 16]),
  runOf("stopper", [9, 0]),
  runOf("attackingCentreBack", [34, 0], [60, 3]),
  runOf("sweeper", [-6, 4], [-5, 16]),
  runOf("libero", [18, 0], [32, 3]),
  runOf("attackingWingBack", [44, -2]),
  runOf("completeWingBack", [44, -2], [-10, 2]),
  runOf("invertedWingBack", [10, 16]),
  runOf("goalscoringWingBack", [24, 0], [46, 18]),
  runOf("halfBack", [-16, 6]),
  runOf("engine", [14, 3], [-10, -3]),
  runOf("wideMidfielder", [20, -1], [-20, 1]),
  runOf("defensiveWinger", [-20, 1]),
  runOf("wideMidfieldPlaymaker", [10, 16]),
  runOf("crosser", [30, -2]),
  runOf("boxToBox", [28, 3], [-10, -3]),
  runOf("ballWinner", [8, -8], [10, 8]),
  runOf("attackingEight", [18, 6], [30, 8]),
  runOf("midfieldEngine", [16, 3], [-12, -3]),
  runOf("winger", [18, -2], [21, 6]),
  runOf("dribbler", [10, 4], [16, 12]),
  runOf("insideForward", [8, 6], [14, 18]),
  runOf("widePlaymaker", [-2, 14]),
  runOf("pressingWinger", [8, 4], [12, 12]),
  runOf("trackingWinger", [-44, -1]),
  runOf("numberTen", [4, 10]),
  runOf("attackingMidfieldShadowStriker", [10, 2], [18, 10]),
  runOf("carrier", [9, 0]),
  runOf("pressingTen", [6, -6], [12, 6]),
  runOf("poacher", [5, 10]),
  runOf("inBehindStriker", [3, -8], [6, 8]),
  runOf("pressingForward", [5, -10], [5, 10]),
  runOf("falseNine", [-16, 2]),
];
