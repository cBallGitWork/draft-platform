// What the patch banner and the patch notes say, in one place for Craig to change in the pull
// request. What each version changed is worked out on the server (convex/scoring/patchChanges.ts),
// and reaches the screen as is.

import { screenMoment } from "../../convex/shared/moments";
import { failedWords } from "../words";
import type { VersionNotes } from "./seam";

export const PATCH_NOTES_TITLE = "Patch notes";
/** The banner's link, and Player scoring's, to the notes. */
export const patchNotesLinkWords = PATCH_NOTES_TITLE;
export const loadingWords = "Loading the patch notes…";
export const noVersionsWords = "No patches yet: every league plays the first scoring set.";
export const notesHint = "Every change to the scoring every league plays on, newest first. Gameweeks played before a version keep the scoring they had.";

export const KIND_WORDS: Record<VersionNotes["kind"], string> = { patch: "Patch", fix: "Fix" };
/** When a version is in force from, on the Premier League's clock (London), as its letter says it. */
export const fromWords = (at: number) => `From ${screenMoment(at)}`;
/** A version made only by reordering the categories. */
export { NOTHING_SCORES_DIFFERENTLY as nothingScoresDifferentlyWords } from "../../convex/scoring/patchChanges";

/** The banner, from a patch's announcement until it takes effect. */
export const bannerWords = (name: string, takesEffectAt: number) => `Scoring patch ${name} takes effect on ${screenMoment(takesEffectAt)}.`;
export const dismissWords = "Dismiss";
/** What a dismissal that failed left. */
export const dismissFailedWords = failedWords("the banner wasn't dismissed");
