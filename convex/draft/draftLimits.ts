// The draft settings' fixed limits (spec/04; #1087), with no imports, so the screens can read them
// too. Each is Craig's (4 Nov 2026, on #1087 and #1089). A league's own values are its rules
// (../rules/leagueRulesShape.ts), never these.

/** The shortest and longest pick clock a league may set, in seconds: 15 seconds to 24 hours. */
export const PICK_SECONDS_FEWEST = 15;
export const PICK_SECONDS_MOST = 24 * 60 * 60;
/** The fewest and most timeouts a manager may get before he goes on auto-pick; "never" is the
 *  other choice, and 0 isn't one. */
export const TIMEOUTS_FEWEST = 1;
export const TIMEOUTS_MOST = 15;
/** The fewest teams a draft starts with, or a start date can be set for (Craig, 4 Nov 2026, on
 *  #1089: "no date until 2 teams, stops people making mock/dummy leagues which is common"). */
export const DRAFT_FEWEST_TEAMS = 2;
/** The most players a team's draft queue holds, and its do-not-draft list: "250 limit for bigger
 *  drafts" (Craig, 4 Nov 2026, on #1092). */
export const DRAFT_LIST_MOST = 250;
