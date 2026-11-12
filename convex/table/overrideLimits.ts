// An override's fixed limits, with no imports, so the screens can read them too. Claude's choice,
// not yet Craig's.

/** How long an override's reason may be (#32). */
export const OVERRIDE_REASON_MAX = 200;
/** The most points an override gives or takes away, so a slip of the keyboard (800 for 8) is
 *  refused rather than scored and mailed to the league. */
export const OVERRIDE_POINTS_MOST = 100;
/** The most a team's override of its gameweek total sets it to either way (#903): a team's total
 *  is many men's, so its bound is wider, there only to refuse a slip of the keyboard. */
export const TEAM_OVERRIDE_POINTS_MOST = 1000;
/** The step of an override's points box: points are kept to a tenth (spec/14), and the server
 *  refuses any finer (pointsOverrides.ts). */
export const OVERRIDE_POINTS_STEP = 0.1;
