import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { liveShortlist } from "./liveShortlist";
import type { ScoutingSeam } from "./seam";

/** The Scouting seam filled in by Convex. */
export const liveScouting: ScoutingSeam = {
  ...liveShortlist,
  usePlayersList: (leagueId, filters, sort, stat) => useQuery(api.scouting.playersList.list, { leagueId, filters, sort, stat }),
};
