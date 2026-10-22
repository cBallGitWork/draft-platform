import type { Session } from "../auth";
import { currentLeagueOf } from "../leagues/roles";
import type { TableSeam } from "./seam";
import { TablePage } from "./TablePage";

/** The table and fixtures of the league the app is in. The frame's guard lets in only someone in
 *  a league; should they leave it while here, this shows nothing until the guard sends them on. */
export function TableRoute({ session, seam }: { session: Session; seam: TableSeam }) {
  const league = currentLeagueOf(session);
  return league ? <TablePage league={league} seam={seam} /> : null;
}
