import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import type { Session } from "../auth";

// Who may do what in a league, as the screens judge it to offer a way in. The server judges again
// on every change (convex/shared/leagueAccess.ts).

/** Whether this person runs the league, as the server's `runnerOf` judges it: its commissioner,
 *  its co-commissioner or the admin. */
export const runs = (league: LeagueSummary, isAdmin: boolean) =>
  isAdmin || league.roles.includes("commissioner") || league.roles.includes("co-commissioner");

/** Whether this person may delete the league, as the server's `deleterOf` judges it: its
 *  commissioner or the admin. */
export const deletes = (league: LeagueSummary, isAdmin: boolean) => isAdmin || league.roles.includes("commissioner");

/** The league with this id, if the person runs it and it isn't being deleted: a league being
 *  deleted is frozen and hidden (spec/13, Deleting), so none of its pages open. */
export function leagueRunBy(session: Session, leagueId: string): LeagueSummary | undefined {
  if (!session.signedIn) return undefined;
  const league = session.leagues.find((each) => each.leagueId === leagueId);
  return league && !league.deletion && runs(league, session.isAdmin) ? league : undefined;
}

/** The league the app is in, or undefined when signed out. */
export const currentLeagueOf = (session: Session): LeagueSummary | undefined =>
  session.signedIn ? session.leagues.find((league) => league.leagueId === session.currentLeagueId) : undefined;
