// The seam for Scouting's players list (#373): what the screen reads. Convex fills it in live
// (liveScouting.ts); the preview and the tests hand the screen their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { PlayersFilters, PlayersList, PlayersSort } from "../../convex/scouting/playersList";
import type { ShortlistSeam } from "./shortlistSeam";

export type { PlayersFilters, PlayersList, PlayersSort };
export type { Availability, ListedPlayer, SortColumn } from "../../convex/scouting/playersList";

/** The players list, and beside it the manager's shortlist. */
export type ScoutingSeam = ShortlistSeam & {
  /** The players the filters keep, in the sort's order, each with his season total of the shown
   *  stat (a catalogue key, or null for none), and every club for the club filter, live (a hook):
   *  undefined while they load. */
  usePlayersList(leagueId: Id<"leagues">, filters: PlayersFilters, sort: PlayersSort, stat: string | null): PlayersList | undefined;
};
