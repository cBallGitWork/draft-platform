// The seam for the Premier League section (#49; spec/18): what the screen reads. Convex fills it in
// live (livePremierLeague.ts); the preview and the tests hand the screen their own.

import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";

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
  /** The table, live (a hook): undefined while it loads. */
  useStandings(): PlStandings | undefined;
};
