// The seam for Scouting's players list (#373): what the screen reads. Convex fills it in live
// (liveScouting.ts); the preview and the tests hand the screen their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { Comparison } from "../../convex/scouting/compare";
import type { PlayersFilters, PlayersList, PlayersSort } from "../../convex/scouting/playersList";
import type { StatRace } from "../../convex/scouting/statRace";
import type { QueueFromShortlist, ShortlistSeam } from "./shortlist/seam";

export type { Comparison, PlayersFilters, PlayersList, PlayersSort, StatRace };
export type { RacingTeam } from "../../convex/scouting/statRace";
export type { ComparedPlayer } from "../../convex/scouting/compare";
export type { Availability, ListedPlayer, SortColumn } from "../../convex/scouting/playersList";

/** The players list, and beside it the manager's shortlist, which feeds his draft queue. */
export type ScoutingSeam = ShortlistSeam & QueueFromShortlist & {
  /** The two players with these codes side by side, live (a hook): undefined while it loads, and
   *  with null for the codes, as nothing is asked. */
  useComparison(leagueId: Id<"leagues">, codes: readonly number[] | null): Comparison | undefined;
  /** The players the filters keep, in the sort's order, each with his season total of the shown
   *  stat (a catalogue key, an own stat's of the site's set, or null for none), every club for the
   *  club filter and the site set's own stats for the stat box, live (a hook):
   *  undefined while they load. */
  usePlayersList(leagueId: Id<"leagues">, filters: PlayersFilters, sort: PlayersSort, stat: string | null): PlayersList | undefined;
  /** The stat race (#800): every team's season totals, most of `stat` (a catalogue key) first, the
   *  scoring categories and where a mid-season league's totals start, live (a hook): undefined
   *  while it loads. */
  useStatRace(leagueId: Id<"leagues">, stat: string): StatRace | undefined;
};
