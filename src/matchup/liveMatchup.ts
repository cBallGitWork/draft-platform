import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { MatchupSeam } from "./seam";

/** The matchup seam filled in by Convex. */
export const liveMatchup: MatchupSeam = {
  useMatchup: (leagueId, now, asked) => useQuery(api.matchup.matchup.ofTeam, { leagueId, now, ...asked }),
};
