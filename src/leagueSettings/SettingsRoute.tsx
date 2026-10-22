import type { Session } from "../auth";
import { leagueRunBy } from "../leagues/roles";
import type { LeagueSettingsSeam } from "./seam";
import { SettingsPage } from "./SettingsPage";

/** League settings for the league in the address. The route's guard lets in only someone who runs
 *  it; should they stop while here, this shows nothing until the guard sends them on. */
export function SettingsRoute({ session, seam, leagueId }: { session: Session; seam: LeagueSettingsSeam; leagueId: string }) {
  const league = leagueRunBy(session, leagueId);
  return league ? <SettingsPage league={league} seam={seam} /> : null;
}
