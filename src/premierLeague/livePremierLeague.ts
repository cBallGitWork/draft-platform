import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { PremierLeagueSeam } from "./seam";

/** The Premier League seam filled in by Convex. */
export const livePremierLeague: PremierLeagueSeam = {
  useFirstKickoffs: () => useQuery(api.football.plGameweeks.firstKickoffs, {}),
  useGameweekMatches: (gameweek) => useQuery(api.football.matchScores.ofGameweek, { gameweek }),
  useMatch: (leagueId, fixtureCode) => useQuery(api.match.matchPage.ofMatch, { leagueId, fixtureCode }),
  useStandings: () => useQuery(api.football.plStandings.ofSeason, {}),
};
