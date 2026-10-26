// An override's fixed limits, with no imports, so the screens can read them too. Claude's choice,
// not yet Craig's.

/** How long an override's reason may be (#32). */
export const OVERRIDE_REASON_MAX = 200;
/** The most points an override gives or takes away, so a slip of the keyboard (800 for 8) is
 *  refused rather than scored and mailed to the league. */
export const OVERRIDE_POINTS_MOST = 100;
