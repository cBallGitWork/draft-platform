// The seam for My team's Tactics tab (#14): what it reads and asks. My team's seam holds it
// (seam.ts). Convex fills it in live (liveTactics.ts); the preview and the tests hand the screen
// their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { Tactics } from "../../convex/lineup/tactics";
import type { Change } from "../refusal";
import type { DraftLineup } from "./lineupDraft";

export type { Tactics };

export type LineupChanges = {
  /** Saves the manager's own team's lineup, from the next gameweek not begun. */
  save(leagueId: Id<"leagues">, lineup: DraftLineup): Change;
};

export type TacticsSeam = {
  /** The lineup to set and all it is set from, at `now` (the start of the minute), live (a hook):
   *  undefined while it loads. */
  useTactics(leagueId: Id<"leagues">, now: number): Tactics | undefined;
  /** The changes to it (a hook). */
  useLineupChanges(): LineupChanges;
};
