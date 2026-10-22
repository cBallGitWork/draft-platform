// The seam for a league's table and fixtures (#33): what the screen reads. Convex fills it in live
// (liveTable.ts); the preview and the tests hand the screen their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueTable } from "../../convex/table/leagueTable";

export type { LeagueTable };

export type TableSeam = {
  /** The league's fixtures and table, live (a hook): undefined while they load, null for a league
   *  made before rules were held. */
  useLeagueTable(leagueId: Id<"leagues">): LeagueTable | null | undefined;
};
