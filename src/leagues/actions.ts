// The seam for leagues (#24): what the screens can ask of them. Convex fills it in live
// (liveLeagueActions.ts); the preview and the tests hand the screens their own.

import type { Id } from "../../convex/_generated/dataModel";

export type NewLeague = { name: string; maxTeams: number; commissionerEmail: string };

export type LeagueActions = {
  /** Creates a league (the admin only), and resolves with null once it exists, or with the words
   *  saying why it wasn't made. It never rejects. */
  createLeague(league: NewLeague): Promise<string | null>;
  /** Deletes a league (the admin or its commissioner), undoable for a day (#75); resolves as
   *  `createLeague` does. */
  deleteLeague(leagueId: Id<"leagues">): Promise<string | null>;
  /** Undoes deleting a league (whoever deleted it, or the admin); resolves as `createLeague` does. */
  undoDeletion(leagueId: Id<"leagues">): Promise<string | null>;
};
