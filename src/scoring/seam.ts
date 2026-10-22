// The seam for the rules editor (#30): what the screen reads of a league's scoring and asks of it.
// Convex fills it in live (liveScoring.ts); the preview and the tests hand the screen their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { Revision, RulesView } from "../rules/rulesDraft";
import type { Scoring } from "./editing";

/** The league's scoring set, the rules row it is from, and the gameweek a change saved now would
 *  take effect from. */
export type ScoringView = RulesView<Scoring>;

export type ScoringSeam = {
  /** Live (a hook): undefined while it loads, null for a league made before leagues held rules. */
  useScoring(leagueId: Id<"leagues">): ScoringView | null | undefined;
  /** Saves the set, edited from the rules `revision` names: resolves with the gameweek it takes
   *  effect from, or the words saying why not. It never rejects. */
  save(leagueId: Id<"leagues">, scoring: Scoring, revision: Revision): Promise<number | string>;
};
