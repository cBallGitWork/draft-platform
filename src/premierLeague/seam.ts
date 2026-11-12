// The seam for the Premier League section (#49; spec/18) and the match page each fixture opens
// (#45; spec/10): what the screens read. Convex fills it in live (livePremierLeague.ts); the preview
// and the tests hand the screens their own.

import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { MatchMan, MatchPageData } from "../../convex/match/matchPage";

export type { MatchMan, MatchPageData };

/** How many gameweeks the season has, and each one's first kickoff (football/plGameweeks:firstKickoffs). */
export type PlGameweeks = FunctionReturnType<typeof api.football.plGameweeks.firstKickoffs>;
/** A gameweek's first kickoff. */
export type FirstKickoff = PlGameweeks["firstKickoffs"][number];
/** A match of one gameweek, its clubs and its newest score (football/matchScores:ofGameweek). */
export type GameweekMatch = FunctionReturnType<typeof api.football.matchScores.ofGameweek>[number];
/** The Premier League table, and whether a match in it is still being played
 *  (football/plStandings:ofSeason). */
export type PlStandings = FunctionReturnType<typeof api.football.plStandings.ofSeason>;

export type PremierLeagueSeam = {
  /** The season's gameweeks and each one's first kickoff, live (a hook): undefined while they load. */
  useGameweeks(): PlGameweeks | undefined;
  /** One gameweek's matches with their scores, live (a hook): undefined while they load. */
  useGameweekMatches(gameweek: number): GameweekMatch[] | undefined;
  /** One match as the league sees it (match/matchPage:ofMatch), its commentary at `now`, the screen's minute, live
   *  (a hook): undefined while it loads, null while no match with its code is held. */
  useMatch(leagueId: Id<"leagues">, now: number, fixtureCode: number): MatchPageData | null | undefined;
  /** The table, live (a hook): undefined while it loads. */
  useStandings(): PlStandings | undefined;
};
