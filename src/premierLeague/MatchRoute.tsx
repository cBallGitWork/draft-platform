import type { Session } from "../auth";
import { currentLeagueOf } from "../leagues/roles";
import { MatchPage } from "./MatchPage";
import type { PremierLeagueSeam } from "./seam";

/** A real match's page, for the league the app is in. The frame's guard lets in only someone in a
 *  league; should they leave it while here, this shows nothing until the guard sends them on. */
export function MatchRoute({ session, seam, fixtureCode }: { session: Session; seam: PremierLeagueSeam; fixtureCode: number }) {
  const league = currentLeagueOf(session);
  // Keyed by the league and the match, so a switch starts afresh.
  return league ? <MatchPage key={`${league.leagueId}/${fixtureCode}`} league={league} seam={seam} fixtureCode={fixtureCode} /> : null;
}
