import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { matchPageAt } from "../../convex/matchup/commentaryAt";
import type { PremierLeagueSeam } from "./seam";

/** The Premier League seam filled in by Convex. The match page is read without the minute, so it
 *  is read again only when its data changes; its commentary's delay is judged here at the screen's
 *  minute (#1550; commentaryAt.ts). */
export const livePremierLeague: PremierLeagueSeam = {
  useGameweeks: () => useQuery(api.football.plGameweeks.firstKickoffs, {}),
  useGameweekMatches: (gameweek) => useQuery(api.football.matchScores.ofGameweek, { gameweek }),
  useMatch: (leagueId, now, fixtureCode) => {
    const held = useQuery(api.match.matchPage.ofMatch, { leagueId, fixtureCode });
    return useMemo(() => (held === undefined || held === null ? held : matchPageAt(held, now)), [held, now]);
  },
  useStandings: () => useQuery(api.football.plStandings.ofSeason, {}),
  useClub: (leagueId, clubCode) => useQuery(api.football.clubPage.ofClub, { leagueId, clubCode }),
};
