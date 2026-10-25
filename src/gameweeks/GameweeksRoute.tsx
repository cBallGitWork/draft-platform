import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { GameweeksPage } from "./GameweeksPage";
import type { GameweeksSeam } from "./seam";

/** The gameweeks page for a league its runner opens, its view read through the seam. */
export function GameweeksRoute({ league, seam }: { league: LeagueSummary; seam: GameweeksSeam }) {
  return <GameweeksPage league={league} view={seam.useLeagueGameweeks(league.leagueId)} />;
}
