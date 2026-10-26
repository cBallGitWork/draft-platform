import type { ComponentType } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import type { Session } from "../auth";
import { currentLeagueOf } from "../leagues/roles";
import type { MyTeamSeam } from "./seam";

/** One of My team's tabs, for the league the app is in. The frame's guard lets in only someone in
 *  a league; should they leave it while here, this shows nothing until the guard sends them on. */
export function MyTeamRoute({ session, seam, Tab }: { session: Session; seam: MyTeamSeam; Tab: ComponentType<{ league: LeagueSummary; seam: MyTeamSeam }> }) {
  const league = currentLeagueOf(session);
  // Keyed by the league, so a switch starts afresh.
  return league ? <Tab key={league.leagueId} league={league} seam={seam} /> : null;
}
