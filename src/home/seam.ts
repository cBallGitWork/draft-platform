// The seam for league home (#387): what the screen reads. Convex fills it in live (liveHome.ts);
// the preview and the tests hand the screen their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueHome } from "../../convex/home/leagueHome";

export type { LeagueHome };

export type HomeSeam = {
  /** League home at the minute `now`, live (a hook): undefined while it loads, null for a league
   *  made before rules were held. */
  useLeagueHome(leagueId: Id<"leagues">, now: number): LeagueHome | null | undefined;
};
