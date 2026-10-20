// The seam for a league's gameweeks (#74): what the commissioner's screen asks of them. Convex
// fills it in live (liveGameweeks.ts); the preview and the tests hand the screen their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueGameweek } from "../../convex/leagueGameweeks";
import type { LeagueSummary } from "../../convex/myLeagues";
import type { Session } from "../auth";

export type LeagueGameweeksView = {
  /** The league's gameweeks, 1 to 38, or undefined while they load. */
  gameweeks: readonly LeagueGameweek[] | undefined;
  /** Ticks (`used`) or unticks a gameweek, and resolves with null once done, or with the words
   *  saying why it wasn't. It never rejects. */
  setUsed(gameweek: number, used: boolean): Promise<string | null>;
};

export type GameweeksSeam = { useLeagueGameweeks(leagueId: Id<"leagues">): LeagueGameweeksView };

/** Where a league's gameweeks are ticked. */
export const GAMEWEEKS_ROUTE = "/leagues/$leagueId/gameweeks";
export const gameweeksPath = (leagueId: string) => `/leagues/${leagueId}/gameweeks`;

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
