// The seam for My team's tabs (#364, #365, #366): what they read. Convex fills it in live (liveMyTeam.ts); the
// preview and the tests hand the screens their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { TeamSquad } from "../../convex/squads/teamSquad";
import type { TeamTransactions } from "../../convex/squads/teamTransactions";
import type { TeamFixtures } from "../../convex/table/teamFixtures";

export type { TeamFixtures, TeamSquad, TeamTransactions };

export type MyTeamSeam = {
  /** The manager's team's games for the season, live (a hook): undefined while they load, null
   *  for a league made before rules were held. */
  useTeamFixtures(leagueId: Id<"leagues">): TeamFixtures | null | undefined;
  /** The manager's team's transactions, newest first, live (a hook): undefined while they load. */
  useTeamTransactions(leagueId: Id<"leagues">): TeamTransactions | undefined;
  /** The manager's team's squad, with each player's next fixture and points, live (a hook):
   *  undefined while it loads. */
  useTeamSquad(leagueId: Id<"leagues">): TeamSquad | undefined;
};
