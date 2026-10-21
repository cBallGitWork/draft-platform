// The seam for a league's gameweeks (#74): what the commissioner's screen asks of them. Convex
// fills it in live (liveGameweeks.ts); the preview and the tests hand the screen their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueGameweek } from "../../convex/leagueGameweeks";

export type LeagueGameweeksView = {
  /** The league's gameweeks, 1 to 38, or undefined while they load. */
  gameweeks: readonly LeagueGameweek[] | undefined;
  /** Ticks (`used`) or unticks a gameweek, and resolves with null once done, or with the words
   *  saying why it wasn't. It never rejects. */
  setUsed(gameweek: number, used: boolean): Promise<string | null>;
};

export type GameweeksSeam = { useLeagueGameweeks(leagueId: Id<"leagues">): LeagueGameweeksView };
