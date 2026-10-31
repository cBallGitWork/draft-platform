// The seam for a manager's shortlist (#374, spec/19 The shortlist): what Scouting and the player
// card read and ask of it. Both screens' seams hold it (../seam.ts, playerCard/seam.ts). Convex fills
// it in live (liveShortlist.ts); the preview and the tests hand the screens their own.

import type { Id } from "../../../convex/_generated/dataModel";
import type { ShortlistedPlayer } from "../../../convex/scouting/shortlist";
import type { Change } from "../../shared/refusal";

export type { ShortlistedPlayer };

/** Putting a player on the manager's own shortlist in a league, and taking him off. */
export type ShortlistChanges = {
  add(leagueId: Id<"leagues">, playerCode: number): Change;
  remove(leagueId: Id<"leagues">, playerCode: number): Change;
};

export type ShortlistSeam = {
  /** The manager's own shortlist in the league, by name, live (a hook): undefined while it loads,
   *  null for someone who runs no team there, who has none. */
  useShortlist(leagueId: Id<"leagues">): readonly ShortlistedPlayer[] | null | undefined;
  /** The changes to it (a hook). */
  useShortlistChanges(): ShortlistChanges;
};
