// The seam for the site's scoring patches as managers meet them (#356): the banner while a patch
// waits to take effect, dismissing it, and the patch notes. Convex fills it in live
// (livePatches.ts); the preview and the tests hand the screens their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { VersionNotes, WaitingPatch } from "../../convex/scoring/patchNotes";
import type { Change } from "../shared/refusal";

export type { VersionNotes, WaitingPatch };

export type PatchesSeam = {
  /** The patch whose banner shows now, live (a hook): null for none, undefined while it loads. */
  useBanner(): WaitingPatch | null | undefined;
  /** Dismisses that patch's banner for whoever is signed in. */
  dismiss(versionId: Id<"siteScoring">): Change;
  /** Every version, newest first, with what it changed, live (a hook): undefined while it loads. */
  useNotes(): readonly VersionNotes[] | undefined;
};
