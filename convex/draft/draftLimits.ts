// The draft settings' fixed limits (spec/04; #1087), with no imports, so the screens can read them
// too. Each is Craig's (4 Nov 2026, on #1087). A league's own values are its rules
// (../rules/leagueRulesShape.ts), never these.

/** The shortest and longest pick clock a league may set, in seconds: 15 seconds to 24 hours. */
export const PICK_SECONDS_FEWEST = 15;
export const PICK_SECONDS_MOST = 24 * 60 * 60;
/** The fewest and most timeouts a manager may get before he goes on auto-pick; "never" is the
 *  other choice, and 0 isn't one. */
export const TIMEOUTS_FEWEST = 1;
export const TIMEOUTS_MOST = 15;
