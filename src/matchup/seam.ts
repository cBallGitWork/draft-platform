// The seam for the matchup (#34): what the screen reads. Convex fills it in live
// (liveMatchup.ts); the preview and the tests hand the screen their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { Matchup } from "../../convex/matchup/matchupShape";

export type { Matchup };

/** Which matchup: a team's (the manager's own when none) in a gameweek (the latest begun when none). */
export type MatchupAsked = { teamId?: Id<"teams">; gameweek?: number };

export type MatchupSeam = {
  /** The matchup at the minute `now`, live (a hook): undefined while it loads, null for a league
   *  made before rules were held. */
  useMatchup(leagueId: Id<"leagues">, now: number, asked: MatchupAsked): Matchup | null | undefined;
};
