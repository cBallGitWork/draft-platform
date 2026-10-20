// The seam for leagues (#24): what the screens can ask of them. Convex fills it in live
// (liveLeagueActions.ts); the preview and the tests hand the screens their own.

import type { Id } from "../../convex/_generated/dataModel";

export type NewLeague = { name: string; maxTeams: number; commissionerEmail: string };

export type LeagueActions = {
  /** Creates a league (the admin only), and resolves with null once it exists, or with the words
   *  saying why it wasn't made. It never rejects. */
  createLeague(league: NewLeague): Promise<string | null>;
  /** Switches to one of the person's leagues (#76), and resolves with null once the app is in it,
   *  or with the words saying why not. It never rejects. */
  chooseLeague(leagueId: Id<"leagues">): Promise<string | null>;
};
