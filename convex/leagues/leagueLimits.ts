// A league's fixed limits, with no imports, so the screens can read them too.

/** How many teams a league may hold (spec/13, Creating a league). */
export const FEWEST_TEAMS = 2;
export const MOST_TEAMS = 20;
/** How long a team's name may be (spec/13, Teams). */
export const TEAM_NAME_MAX = 30;
/** How long a league's name may be: the same as a team's, Craig agreed (22 Oct 2026), so a
 *  change to one is a change to both. */
export const LEAGUE_NAME_MAX = TEAM_NAME_MAX;
/** How long a deleted league can be undone before it is gone for good (spec/13, Deleting). */
export const DELETION_UNDO_HOURS = 24;
/** The most players one team can hold, whatever the league's own squad limits (spec/03), which
 *  only warn: a bound for reading a squad (#31), so a league's squad maximum can't be above it. */
export const MOST_IN_SQUAD = 60;
