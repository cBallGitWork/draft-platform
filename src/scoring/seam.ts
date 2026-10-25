// The seam for Player scoring and the rules editor (#30): what the screen reads of the site's
// scoring, which every league plays on (spec/14, Who owns it; #354), and asks of it. Convex fills
// it in live (liveScoring.ts); the preview and the tests hand the screen their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { RulesView } from "../rules/rulesDraft";
import type { Scoring } from "./editing";

/** The site's scoring version a set was read from: null while the site plays its first set. */
export type SiteRevision = Id<"siteScoring"> | null;

/** The site's scoring set, the version it is, the gameweek a change saved now would take effect
 *  from, and whether the reader may change it: only the admin may. */
export type ScoringView = RulesView<Scoring, SiteRevision> & { canEdit: boolean };

export type ScoringSeam = {
  /** Live (a hook): undefined while it loads. */
  useScoring(): ScoringView | undefined;
  /** Saves the set, edited from the version `revision` names: resolves with the gameweek it takes
   *  effect from, or the words saying why not. It never rejects. */
  save(scoring: Scoring, revision: SiteRevision): Promise<number | string>;
};
