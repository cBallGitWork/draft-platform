import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import type { Session } from "../signIn/seam";

// Who may do what in a league, as the screens judge it to offer a way in. The server judges again
// on every change (convex/shared/leagueAccess.ts).

/** Whether this person runs the league: its commissioner, its co-commissioner or the admin, as
 *  the server sent it (powersIn). */
export const runs = (league: LeagueSummary) => league.powers.runs;

/** Whether this person may delete the league: its commissioner or the admin, as the server sent
 *  it (powersIn). */
export const deletes = (league: LeagueSummary) => league.powers.names;

/** The league with this id, if the person has a part in it (or is the admin) and it isn't being
 *  deleted: a league being deleted is frozen and hidden (spec/13, Deleting), so none of its pages
 *  open. */
export function leagueIn(session: Session, leagueId: string): LeagueSummary | undefined {
  if (!session.signedIn) return undefined;
  const league = session.leagues.find((each) => each.leagueId === leagueId);
  return league && !league.deletion ? league : undefined;
}

/** The league with this id, as `leagueIn` finds it, if the person runs it. */
export function leagueRunBy(session: Session, leagueId: string): LeagueSummary | undefined {
  const league = leagueIn(session, leagueId);
  return league && runs(league) ? league : undefined;
}

/** The league the app is in, or undefined when signed out or no longer among their leagues. */
export const currentLeagueOf = (session: Session): LeagueSummary | undefined =>
  session.signedIn ? session.leagues.find((league) => league.leagueId === session.currentLeagueId) : undefined;
