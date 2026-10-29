// The seam for leagues (#24): what the screens can ask of them. Convex fills it in live
// (liveLeagues.ts); the preview and the tests hand the screens their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { Change } from "../shared/refusal";

export type NewLeague = { name: string; maxTeams: number; commissionerEmail: string };

export type LeaguesSeam = {
  /** Creates a league (the admin only). */
  createLeague(league: NewLeague): Change;
  /** Switches to one of the person's leagues (#76); made once the app is in it. */
  switchLeague(leagueId: Id<"leagues">): Change;
  /** Deletes a league (the admin or its commissioner), undoable for a day (#75). */
  deleteLeague(leagueId: Id<"leagues">): Change;
  /** Undoes deleting a league (its commissioner or the admin, whichever deleted it). */
  undoDeletion(leagueId: Id<"leagues">): Change;
  /** The person leaves the league, giving up their team in it (spec/13, Leaving). */
  leaveLeague(leagueId: Id<"leagues">): Change;
};
