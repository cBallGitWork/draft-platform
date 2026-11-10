// The seam for a league's table and fixtures (#33): what the screen reads. Convex fills it in live
// (liveTable.ts); the preview and the tests hand the screen their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueTable } from "../../convex/table/leagueTable";
import type { LEAGUE_AVERAGE } from "../../convex/table/roundRobin";
import type { Change } from "../shared/refusal";

export type { LeagueTable };

export type TableSeam = {
  /** The league's fixtures and table, live (a hook): undefined while they load, null for a league
   *  made before rules were held. */
  useLeagueTable(leagueId: Id<"leagues">): LeagueTable | null | undefined;
};

/** A side of a game: a team, or the league's average. */
export type Side = Id<"teams"> | typeof LEAGUE_AVERAGE;
/** A side picked to move out of its game, and the side it plays there. */
export type PickedSide = { moves: Side; against: Side };

/** A commissioner's fixture swap (spec/09, Fixture edits; convex/table/fixtureEdits.ts). */
export type FixtureSwap = {
  /** Swaps `one`'s and `other`'s moving sides between their two games in `gameweek`. */
  swap(leagueId: Id<"leagues">, gameweek: number, one: PickedSide, other: PickedSide): Change;
};

/** The table and fixtures screen's: the table, and the commissioner's fixture swap (a hook). */
export type TableScreenSeam = TableSeam & { useFixtureSwap(): FixtureSwap };
