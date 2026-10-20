import type { LeagueSummary } from "../../convex/myLeagues";
import type { Session } from "../auth";
import { GameweeksPage } from "./GameweeksPage";
import { leagueRunBy, type GameweeksSeam } from "./seam";

/** The gameweeks page for the league in the address. The route's guard lets in only someone who
 *  runs it; should they stop while here, this shows nothing until the guard sends them on. */
export function GameweeksRoute({ session, seam, leagueId }: { session: Session; seam: GameweeksSeam; leagueId: string }) {
  const league = leagueRunBy(session, leagueId);
  return league ? <LeagueGameweeks league={league} seam={seam} /> : null;
}

function LeagueGameweeks({ league, seam }: { league: LeagueSummary; seam: GameweeksSeam }) {
  return <GameweeksPage league={league} view={seam.useLeagueGameweeks(league.leagueId)} />;
}
