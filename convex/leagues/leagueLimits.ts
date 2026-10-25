// A league's fixed limits, with no imports, so the screens can read them too.

/** How many teams a league may hold (spec/13, Creating a league). */
export const FEWEST_TEAMS = 2;
export const MOST_TEAMS = 20;
/** How long a team's name may be (spec/13, Teams). */
export const TEAM_NAME_MAX = 30;
/** How long a league's name may be: the same as a team's (Craig, 22 Oct 2026). */
export const LEAGUE_NAME_MAX = TEAM_NAME_MAX;
/** How long a deleted league can be undone before it is gone for good (spec/13, Deleting). */
export const DELETION_UNDO_HOURS = 24;
/** A Premier League squad, the most a league's squad maximum may be (spec/03, Squad make-up: "a
 *  prem squad is 25"). Also the most players one team can hold whatever its league's maximum,
 *  which only warns: a bound for reading a squad (#31). */
export const MOST_IN_SQUAD = 25;
/** The most leagues "Your leagues" lists, and of each kind of part in one: the closed beta has a
 *  handful. Past it the list says more exist rather than dropping them unsaid (#144). */
export const LEAGUES_SHOWN = 200;
