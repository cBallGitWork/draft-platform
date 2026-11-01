// The seam for My team's Tactics tab (#14): what it reads and asks. My team's seam holds it
// (../seam.ts). Convex fills it in live (liveTactics.ts); the preview and the tests hand the screen
// their own.

import type { Id } from "../../../convex/_generated/dataModel";
import type { OpenTactics, Tactics } from "../../../convex/lineup/tactics";
import type { DraftLineup } from "./lineupDraft";

export type { OpenTactics, Tactics };

export type LineupChanges = {
  /** Saves the manager's own team's lineup, from the next gameweek not begun as the server judges
   *  it: resolves with that gameweek, or with the words saying why not. It never rejects. */
  save(leagueId: Id<"leagues">, lineup: DraftLineup): Promise<number | string>;
};

export type TacticsSeam = {
  /** The lineup to set and all it is set from, at `now` (the start of the minute), live (a hook):
   *  undefined while it loads. */
  useTactics(leagueId: Id<"leagues">, now: number): Tactics | undefined;
  /** The changes to it (a hook). */
  useLineupChanges(): LineupChanges;
  /** Tells the server the manager opened the tab, once a visit, when it first shows a `gameweek`
   *  (null until then), so Continue stops leading him here for it (spec/12; a hook). A gameweek
   *  that changes while the tab stays open tells nothing. */
  useTacticsOpened(leagueId: Id<"leagues">, gameweek: number | null): void;
};
