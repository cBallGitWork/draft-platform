// The seam for Player scoring and the rules editor (#30): what the screen reads of the site's
// scoring, which every league plays on (spec/14, Who owns it; #354), and asks of it. Convex fills
// it in live (liveScoring.ts); the preview and the tests hand the screen their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { LabReport } from "../../convex/balanceLab/labReportShape";
import type { VersionNotes } from "../patches/seam";
import type { Change } from "../shared/refusal";
import type { RulesView } from "../rules/rulesDraft";
import type { Scoring } from "./editing";

/** The site's scoring version a set was read from: null while the site plays its first set. */
export type SiteRevision = Id<"siteScoring"> | null;

/** One version of the site's scoring, as the versions list shows it (Craig, 6 Nov 2026, on #368). */
export type ScoringVersion = {
  id: Id<"siteScoring">;
  name: string;
  kind: VersionNotes["kind"];
  announcedAt: number;
  takesEffectAt: number;
  /** The first gameweek it reaches. */
  fromGameweek: number;
};

/** A gameweek a patch announced now can take effect from, and the moment that is. */
export type PatchGameweek = { gameweek: number; takesEffectAt: number };

/** The admin's draft patch as saved, and when. */
export type SavedDraft = { part: Scoring; savedAt: number };

/** The site's scoring set, the version it is, the gameweek a change saved now would take effect
 *  from, and whether the reader may change it: only the admin may. Every version, oldest first;
 *  and, for the admin alone, the draft patch and the gameweeks a patch can take effect from. */
export type ScoringView = RulesView<Scoring, SiteRevision> & {
  canEdit: boolean;
  versions: readonly ScoringVersion[];
  draft: SavedDraft | null;
  patchGameweeks: readonly PatchGameweek[];
};

/** A patch announced: its name and the first gameweek it reaches. */
export type Announced = { name: string; fromGameweek: number };

export type ScoringSeam = {
  /** Live (a hook): undefined while it loads. */
  useScoring(): ScoringView | undefined;
  /** Saves the set as a fix, edited from the version `revision` names: resolves with the gameweek
   *  it takes effect from, or the words saying why not. It never rejects. */
  save(scoring: Scoring, revision: SiteRevision): Promise<number | string>;
  /** Saves the set as the draft patch, made from `revision`, over the draft saved at
   *  `draftSavedAt` (null for none): resolves with when it was saved, or the words saying why not. */
  saveDraft(scoring: Scoring, revision: SiteRevision, draftSavedAt: number | null): Promise<number | string>;
  /** Announces the draft saved at `draftSavedAt` to take effect at `takesEffectAt`. */
  announce(draftSavedAt: number, takesEffectAt: number): Promise<Announced | string>;
  /** Withdraws the patch `versionId` names, back to the draft. */
  withdraw(versionId: Id<"siteScoring">): Change;
  /** Runs the rule balance lab on the draft saved at `draftSavedAt`: its report, saved nowhere, or
   *  the words saying why not. It never rejects. */
  runLab(draftSavedAt: number): Promise<LabReport | string>;
};
