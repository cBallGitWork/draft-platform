import type { Session } from "../auth";
import { currentLeagueOf } from "../leagues/roles";
import { MatchupPage } from "./MatchupPage";
import type { MatchupAsked, MatchupSeam } from "./seam";

/** The matchup in the league the app is in. The frame's guard lets in only someone in a league;
 *  should they leave it while here, this shows nothing until the guard sends them on. */
export function MatchupRoute({ session, seam, asked }: { session: Session; seam: MatchupSeam; asked: MatchupAsked }) {
  const league = currentLeagueOf(session);
  // Keyed by the league, so a switch starts afresh.
  return league ? <MatchupPage key={league.leagueId} league={league} seam={seam} asked={asked} /> : null;
}
