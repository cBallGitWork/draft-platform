import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { HomeSeam } from "./seam";

/** The league home seam filled in by Convex. */
export const liveHome: HomeSeam = {
  useLeagueHome: (leagueId, now) => useQuery(api.home.leagueHome.ofLeague, { leagueId, now }),
  useRecap: (leagueId, gameweek) => useQuery(api.home.recaps.ofGameweek, { leagueId, gameweek }),
};
