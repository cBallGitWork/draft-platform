import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useMinute } from "../useMinute";
import { liveTactics } from "./liveTactics";
import type { MyTeamSeam } from "./seam";

/** My team's seam filled in by Convex. */
export const liveMyTeam: MyTeamSeam = {
  ...liveTactics,
  useTeamFixtures: (leagueId) => useQuery(api.table.teamFixtures.ofMyTeam, { leagueId }),
  useTeamTransactions: (leagueId) => useQuery(api.squads.teamTransactions.ofMyTeam, { leagueId }),
  // Asked at the screen's minute, as a query may not read the clock: the next fixture moves on with it.
  useTeamSquad: (leagueId) => useQuery(api.squads.teamSquad.ofMyTeam, { leagueId, now: useMinute() }),
};
