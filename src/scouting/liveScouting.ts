import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { ScoutingSeam } from "./seam";

/** The Scouting seam filled in by Convex. */
export const liveScouting: ScoutingSeam = {
  usePlayersList: (leagueId, filters, sort, stat) => useQuery(api.scouting.playersList.list, { leagueId, filters, sort, stat }),
};
