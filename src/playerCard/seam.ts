// The seam for a player's card (#381): what the screen reads. Convex fills it in live
// (livePlayerCard.ts); the preview and the tests hand the screen their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { PlayedMatch, PlayerCard } from "../../convex/playerCard/playerCard";

export type { PlayedMatch, PlayerCard };

export type PlayerCardSeam = {
  /** His card at `now`, live (a hook): undefined while it loads, null for a code no feed holds. */
  usePlayerCard(leagueId: Id<"leagues">, playerCode: number, now: number): PlayerCard | null | undefined;
};
