import type { Session } from "../auth";
import { leagueRunBy } from "../leagues/roles";
import { SquadsPage } from "./SquadsPage";
import type { SquadsSeam } from "./seam";

/** The squads page for the league in the address. The route's guard lets in only someone who runs
 *  it; should they stop while here, this shows nothing until the guard sends them on. */
export function SquadsRoute({ session, seam, leagueId }: { session: Session; seam: SquadsSeam; leagueId: string }) {
  const league = leagueRunBy(session, leagueId);
  return league ? <SquadsPage league={league} seam={seam} /> : null;
}
