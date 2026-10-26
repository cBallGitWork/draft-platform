// The seam for My team's tabs (#365): what they read. Convex fills it in live (liveMyTeam.ts); the
// preview and the tests hand the screens their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { TeamFixtures } from "../../convex/table/teamFixtures";

export type { TeamFixtures };

export type MyTeamSeam = {
  /** The manager's team's games for the season, live (a hook): undefined while they load, null
   *  for a league made before rules were held. */
  useTeamFixtures(leagueId: Id<"leagues">): TeamFixtures | null | undefined;
};
