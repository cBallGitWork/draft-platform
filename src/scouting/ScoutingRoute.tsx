import type { Session } from "../auth";
import { currentLeagueOf } from "../leagues/roles";
import type { ScoutingSeam } from "./seam";
import { ScoutingPage } from "./ScoutingPage";

/** Scouting for the league the app is in. The frame's guard lets in only someone in a league;
 *  should they leave it while here, this shows nothing until the guard sends them on. */
export function ScoutingRoute({ session, seam }: { session: Session; seam: ScoutingSeam }) {
  const league = currentLeagueOf(session);
  return league ? <ScoutingPage league={league} seam={seam} /> : null;
}
