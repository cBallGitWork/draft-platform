import type { Session } from "../auth";
import { currentLeagueOf } from "../leagues/roles";
import { HomePage } from "./HomePage";
import type { HomeSeam } from "./seam";

/** League home for the league the app is in. The frame's guard lets in only someone in a league;
 *  should they leave it while here, this shows nothing until the guard sends them on. */
export function HomeRoute({ session, seam }: { session: Session; seam: HomeSeam }) {
  const league = currentLeagueOf(session);
  return league ? <HomePage league={league} seam={seam} /> : null;
}
