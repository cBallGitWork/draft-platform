// The seam for My team's tabs (#364, #365, #366): what they read. Convex fills it in live (liveMyTeam.ts); the
// preview and the tests hand the screens their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { Change } from "../shared/refusal";
import type { TeamSquad } from "../../convex/squads/teamSquad";
import type { TeamTransactions } from "../../convex/squads/teamTransactions";
import type { TeamFixtures } from "../../convex/table/teamFixtures";
import type { TacticsSeam } from "./tactics/tacticsSeam";

export type { TeamFixtures, TeamSquad, TeamTransactions };

export type SquadNumberChanges = {
  /** Gives one of the manager's own players `number`, or null to take it away (#13). */
  set(leagueId: Id<"leagues">, playerCode: number, number: number | null): Change;
};

export type MyTeamSeam = TacticsSeam & {
  /** The manager's team's games for the season, live (a hook): undefined while they load, null
   *  for a league made before rules were held. */
  useTeamFixtures(leagueId: Id<"leagues">): TeamFixtures | null | undefined;
  /** The manager's team's transactions, newest first, live (a hook): undefined while they load. */
  useTeamTransactions(leagueId: Id<"leagues">): TeamTransactions | undefined;
  /** The manager's team's squad, with each player's next fixture and points, live (a hook):
   *  undefined while it loads. */
  useTeamSquad(leagueId: Id<"leagues">): TeamSquad | undefined;
  /** The changes to its squad numbers (a hook). */
  useSquadNumbers(): SquadNumberChanges;
};
