import type { LeagueSummary } from "../../convex/myLeagues";
import type { Session } from "../auth";

// Who may do what in a league, as the screens judge it to offer a way in. The server judges again
// on every change (convex/leagueAccess.ts).

/** Whether this person runs the league, as the server's `runnerOf` judges it: its commissioner,
 *  its co-commissioner or the admin. */
export const runs = (league: LeagueSummary, isAdmin: boolean) =>
  isAdmin || league.roles.includes("commissioner") || league.roles.includes("co-commissioner");

/** Whether this person may delete the league, as the server's `deleterOf` judges it: its
 *  commissioner or the admin. */
export const deletes = (league: LeagueSummary, isAdmin: boolean) => isAdmin || league.roles.includes("commissioner");

/** The league with this id, if the person runs it. */
export function leagueRunBy(session: Session, leagueId: string): LeagueSummary | undefined {
  if (!session.signedIn) return undefined;
  const league = session.leagues.find((each) => each.leagueId === leagueId);
  return league && runs(league, session.isAdmin) ? league : undefined;
}
