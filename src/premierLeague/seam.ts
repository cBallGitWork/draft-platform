// The seam for the Premier League section (#49; spec/18) and the match page each fixture opens
// (#45; spec/10): what the screens read. Convex fills it in live (livePremierLeague.ts); the preview
// and the tests hand the screens their own.

import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { MatchMan, MatchPage } from "../../convex/match/matchPage";

export type { MatchMan, MatchPage };

/** A gameweek's first kickoff (football/plGameweeks:firstKickoffs). */
export type FirstKickoff = FunctionReturnType<typeof api.football.plGameweeks.firstKickoffs>[number];
/** A match of one gameweek, its clubs and its newest score (football/matchScores:ofGameweek). */
export type GameweekMatch = FunctionReturnType<typeof api.football.matchScores.ofGameweek>[number];
/** The Premier League table, and whether a match in it is still being played
 *  (football/plStandings:ofSeason). */
export type PlStandings = FunctionReturnType<typeof api.football.plStandings.ofSeason>;

export type PremierLeagueSeam = {
  /** Each gameweek's first kickoff, live (a hook): undefined while they load. */
  useFirstKickoffs(): FirstKickoff[] | undefined;
  /** One gameweek's matches with their scores, live (a hook): undefined while they load. */
  useGameweekMatches(gameweek: number): GameweekMatch[] | undefined;
  /** One match as the league sees it (match/matchPage:ofMatch), live (a hook): undefined while it
   *  loads, null while no match with its code is held. */
  useMatch(leagueId: Id<"leagues">, fixtureCode: number): MatchPage | null | undefined;
  /** The table, live (a hook): undefined while it loads. */
  useStandings(): PlStandings | undefined;
};
