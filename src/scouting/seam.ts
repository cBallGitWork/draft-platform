// The seam for Scouting's players list (#373): what the screen reads. Convex fills it in live
// (liveScouting.ts); the preview and the tests hand the screen their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { Comparison } from "../../convex/scouting/compare";
import type { Per90Panel } from "../../convex/scouting/per90";
import type { PlayersFilters, PlayersList, PlayersSort } from "../../convex/scouting/playersList";
import type { StatRace } from "../../convex/scouting/statRace";
import type { YourPlayer } from "../../convex/scouting/yourPlayer";
import type { ClaimsSeam } from "../myTeam/claims/seam";
import type { PlayerCardSeam } from "../playerCard/seam";
import type { ScoutsSeam } from "./scouts/seam";
import type { QueueFromShortlist, ShortlistSeam } from "./shortlist/seam";

export type { Comparison, Per90Panel, PlayersFilters, PlayersList, PlayersSort, StatRace, YourPlayer };
export type { RacingTeam } from "../../convex/scouting/statRace";
export type { ComparedPlayer } from "../../convex/scouting/compare";
export type { Availability, ListedPlayer, SortColumn } from "../../convex/scouting/playersList";

/** The player card's pickup, claim and drop, which the selected player's panel offers too. */
export type WaiverActionSeam = Pick<PlayerCardSeam, "useCardAction" | "useWaiverChanges">;

/** The players list, and beside it the selected player's panel, which picks him up or claims him
 *  and says where the manager's pending claim on him stands, the manager's shortlist, which feeds
 *  his draft queue, and his team's scouts. */
export type ScoutingSeam = ShortlistSeam & QueueFromShortlist & ScoutsSeam & WaiverActionSeam & Pick<ClaimsSeam, "usePendingClaims"> & {
  /** The two players with these codes side by side, each with his per-90 figures for the first's
   *  area and the list's stat (or null), live (a hook): undefined while it loads, and with null for
   *  the codes, as nothing is asked. */
  useComparison(leagueId: Id<"leagues">, codes: readonly number[] | null, stat: string | null): Comparison | undefined;
  /** The manager's own player at the main position of the player with this code, to compare him
   *  with, and whether the squad is full, as of `now` (a minute's), live (a hook): undefined while
   *  it loads, null for someone running no team. */
  useYourPlayer(leagueId: Id<"leagues">, playerCode: number, now: number): YourPlayer | undefined;
  /** The selected player's per-90 figures and percentiles, the list's stat (or null) among them,
   *  live (a hook): undefined while they load. */
  usePer90(leagueId: Id<"leagues">, playerCode: number, stat: string | null): Per90Panel | undefined;
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
