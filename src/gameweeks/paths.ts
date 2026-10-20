import type { LeagueSummary } from "../../convex/myLeagues";
import type { Session } from "../auth";
import { LEAGUES_PATH } from "../leagues/paths";

/** Where a league's gameweeks are ticked (#74), as the router matches it, and for one league. */
export const GAMEWEEKS_ROUTE = `${LEAGUES_PATH}/$leagueId/gameweeks`;
export const gameweeksPath = (leagueId: string) => GAMEWEEKS_ROUTE.replace("$leagueId", leagueId);

/** Whether this person runs the league, as the server's `runnerOf` judges it: its commissioner,
 *  its co-commissioner or the admin. */
export const runs = (league: LeagueSummary, isAdmin: boolean) =>
  isAdmin || league.roles.includes("commissioner") || league.roles.includes("co-commissioner");

/** The league with this id, if the person runs it. */
export function leagueRunBy(session: Session, leagueId: string): LeagueSummary | undefined {
  if (!session.signedIn) return undefined;
  const league = session.leagues.find((each) => each.leagueId === leagueId);
  return league && runs(league, session.isAdmin) ? league : undefined;
}
