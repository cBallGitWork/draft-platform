// The seam for My team's tabs (#364, #365, #366): what they read. Convex fills it in live (liveMyTeam.ts); the
// preview and the tests hand the screens their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { Change } from "../shared/refusal";
import type { OtherSquad } from "../../convex/squads/otherSquad";
import type { TeamSquad } from "../../convex/squads/teamSquad";
import type { TeamTransactions } from "../../convex/squads/teamTransactions";
import type { TeamFixtures } from "../../convex/table/teamFixtures";
import type { TacticsSeam } from "./tactics/seam";
import type { SquadSeam } from "./squad/seam";
import type { ClaimsSeam } from "./claims/seam";
import type { TableSeam } from "../table/seam";

export type { OtherSquad, TeamFixtures, TeamSquad, TeamTransactions };

/** The manager's own team's auto team (spec/09): its id, on or off, the gameweek it ends after, and
 *  the gameweeks he may name for it to end after: those the league plays, from the next not begun. */
export type MyAutoTeam = { teamId: Id<"teams">; on: boolean; endsAfter: number | null; endGameweeks: number[] };

/** Switching a team's auto team: its manager's own on My team, any team's on Squads. */
export type AutoTeamChanges = {
  /** On, until after `endsAfter` if given (its manager alone names one), or off. */
  set(leagueId: Id<"leagues">, teamId: Id<"teams">, on: boolean, endsAfter?: number): Change;
};

export type SquadNumberChanges = {
  /** Gives one of the manager's own players `number`, or null to take it away (#13). */
  set(leagueId: Id<"leagues">, playerCode: number, number: number | null): Change;
};

/** The league's table and fixtures (the table's own seam) give the header band its readings; the
 *  claims' seam gives the Transactions tab its claims, waiver order and runs. */
export type MyTeamSeam = TacticsSeam & TableSeam & SquadSeam & ClaimsSeam & {
  /** The manager's team's games for the season, live (a hook): undefined while they load. */
  useTeamFixtures(leagueId: Id<"leagues">): TeamFixtures | undefined;
  /** The manager's team's transactions, newest first, live (a hook): undefined while they load. */
  useTeamTransactions(leagueId: Id<"leagues">): TeamTransactions | undefined;
  /** The manager's team's squad, with each player's next fixture and points, live (a hook):
   *  undefined while it loads. */
  useTeamSquad(leagueId: Id<"leagues">): TeamSquad | undefined;
  /** Another team's squad, read-only (#1027), live (a hook): undefined while it loads. */
  useOtherSquad(leagueId: Id<"leagues">, teamId: Id<"teams">): OtherSquad | undefined;
  /** The changes to its squad numbers (a hook). */
  useSquadNumbers(): SquadNumberChanges;
  /** Its auto team, for the header band, live (a hook): undefined while it loads. */
  useMyAutoTeam(leagueId: Id<"leagues">): MyAutoTeam | undefined;
  /** Switching it (a hook). */
  useAutoTeamChanges(): AutoTeamChanges;
};
