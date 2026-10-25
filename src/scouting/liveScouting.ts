import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { ScoutingSeam } from "./seam";

/** The Scouting seam filled in by Convex. */
export const liveScouting: ScoutingSeam = {
  useComparison: (leagueId, codes) => useQuery(api.scouting.compare.players, codes === null ? "skip" : { leagueId, codes: [...codes] }),
  usePlayersList: (leagueId, filters, sort) => useQuery(api.scouting.playersList.list, { leagueId, filters, sort }),
};
