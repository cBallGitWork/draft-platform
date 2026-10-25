import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { MyTeamSeam } from "./seam";

/** My team's seam filled in by Convex. */
export const liveMyTeam: MyTeamSeam = {
  useTeamFixtures: (leagueId) => useQuery(api.table.teamFixtures.ofMyTeam, { leagueId }),
};
