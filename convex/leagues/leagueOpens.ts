import type { LeagueSummary } from "./myLeagues";

// Whether a league's pages open, with only a type import, so the screens judge it by the server's
// rule (#562): the switcher's list (lastLeague.ts), the route guards, Mail and "Your leagues". The
// server's own checks of a league row use it too (#876).

/** Whether a league opens: it isn't being deleted, which freezes it even for whoever is deleting
 *  it, and hides it from everyone else (spec/13, Deleting; #75). */
export const leagueOpens = (league: Pick<LeagueSummary, "deletion">) => !league.deletion;
