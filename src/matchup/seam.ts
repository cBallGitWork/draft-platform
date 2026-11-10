// The seam for the matchup (#34): what the screen reads, and the team override it makes. Convex
// fills it in live (liveMatchup.ts); the preview and the tests hand the screen their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { Matchup } from "../../convex/matchup/matchupShape";
import type { Change } from "../shared/refusal";

export type { Matchup };

/** Which matchup: a team's (the manager's own when none) in a gameweek (the latest begun when none),
 *  its game numbered from 1 (the first drawn when none, #521). */
export type MatchupAsked = { teamId?: Id<"teams">; gameweek?: number; game?: number };

/** A team's gameweek, whose total an override sets or removes (spec/14 S14.3; #903). */
export type OverriddenTeam = { gameweek: number; teamId: Id<"teams"> };
/** A team's total in a gameweek, set by whoever runs the league, and why. */
export type TeamOverride = OverriddenTeam & { points: number; reason: string };

export type MatchupSeam = {
  /** The matchup at the minute `now`, live (a hook): undefined while it loads. */
  useMatchup(leagueId: Id<"leagues">, now: number, asked: MatchupAsked): Matchup | undefined;
  /** Setting a team's total for a gameweek (a hook; spec/14 S14.3, S14.6). */
  useOverrideTeam(): (leagueId: Id<"leagues">, override: TeamOverride) => Change;
  /** Removing it, so the team scores its worked-out total again (a hook; S14.5). */
  useRemoveTeamOverride(): (leagueId: Id<"leagues">, overridden: OverriddenTeam) => Change;
};
