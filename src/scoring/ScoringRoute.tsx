import type { Session } from "../auth";
import { leagueRunBy } from "../leagues/roles";
import { ScoringPage } from "./ScoringPage";
import type { ScoringSeam } from "./seam";

/** The rules editor for the league in the address. The route's guard lets in only someone who runs
 *  it; should they stop while here, this shows nothing until the guard sends them on. */
export function ScoringRoute({ session, seam, leagueId }: { session: Session; seam: ScoringSeam; leagueId: string }) {
  const league = leagueRunBy(session, leagueId);
  return league ? <ScoringPage league={league} seam={seam} /> : null;
}
