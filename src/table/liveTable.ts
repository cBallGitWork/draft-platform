import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { TableSeam } from "./seam";

/** The table seam filled in by Convex. */
export const liveTable: TableSeam = {
  useLeagueTable: (leagueId) => useQuery(api.leagueTable.ofLeague, { leagueId }),
};
