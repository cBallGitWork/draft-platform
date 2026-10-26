import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { liveTactics } from "./liveTactics";
import type { MyTeamSeam } from "./seam";

/** My team's seam filled in by Convex. */
export const liveMyTeam: MyTeamSeam = {
  ...liveTactics,
  useTeamFixtures: (leagueId) => useQuery(api.table.teamFixtures.ofMyTeam, { leagueId }),
  useTeamTransactions: (leagueId) => useQuery(api.squads.teamTransactions.ofMyTeam, { leagueId }),
};
