// What the patch banner and the patch notes say, in one place for Craig to change in the pull
// request. What each version changed is worked out on the server (convex/scoring/patchChanges.ts),
// and reaches the screen as is.

import { LOCALE, screenMoment } from "../../convex/shared/moments";
import { ROLE_TARGET_MARGIN } from "../../convex/balanceLab/balanceLabLimits";
import { failedWords, seasonShortWords } from "../shared/words";
import type { VersionNotes } from "./seam";

export const PATCH_NOTES_TITLE = "Patch notes";
/** The banner's link, and Player scoring's, to the notes. */
export const patchNotesLinkWords = PATCH_NOTES_TITLE;
export const loadingWords = "Loading the patch notes…";
export const noVersionsWords = "No patches yet.";
export const notesHint = "Gameweeks played before a version keep the scoring they had.";

export const KIND_WORDS: Record<VersionNotes["kind"], string> = { patch: "Patch", fix: "Fix" };
/** When a version is in force from, in the viewer's own zone (convex/shared/moments.ts, #442). */
export const fromWords = (at: number) => `From ${screenMoment(at)}`;
/** A version made only by reordering the categories. */
export { NOTHING_SCORES_DIFFERENTLY as nothingScoresDifferentlyWords } from "../../convex/scoring/patchChanges";

/** The rule balance lab's report (spec/14, The rule balance lab; #843), on the draft patch and in a
 *  patch's notes. */
export const labTitle = "Rule balance lab";
/** Which past seasons it ran on, its starts and those skipped: "On 21/22 to 25/26: 41,820 starts, 96 skipped". */
export const labSummaryWords = (seasons: readonly number[], starts: number, skipped: number) => {
  const first = seasons.at(0);
  const last = seasons.at(-1);
  if (first === undefined || last === undefined) return "No past season is copied yet, so there are no starts to test on.";
  const on = first === last ? seasonShortWords(first) : `${seasonShortWords(first)} to ${seasonShortWords(last)}`;
  return `On ${on}: ${starts.toLocaleString(LOCALE)} real starts, each counted in the slot he started in. Starts skipped (where he started maps to no slot): ${skipped.toLocaleString(LOCALE)}.`;
};
export const labHint = `Each role's average a start over its slot's real starts, against the slot's target role adjustment. More than ${ROLE_TARGET_MARGIN} off it is flagged.`;
export const labColumns = {
  role: { short: "Role", long: "Role" },
  slot: { short: "Slot", long: "Slot" },
  target: { short: "Target", long: "Target role adjustment a start" },
  average: { short: "Avg", long: "Average a start" },
  starts: { short: "Starts", long: "Starts tested on" },
} as const;
export const offTargetWords = "Off target";
/** A role scoring a stat the past seasons weren't copied with (Craig, 7 Nov 2026, on #843). */
export const notTestedWords = (stats: readonly string[]) => `Not tested: no past ${stats.join(", ")}`;
export const noStartsWords = "No starts";
export const noRolesWords = "The set scores no roles.";
/** The set scores no team instructions (spec/05 Team instructions), so none are checked. */
export const noTeamInstructionsWords = "The set scores no team instructions.";
/** Why no team instruction has an average yet (spec/14 S14.9; #1541). */
export const instructionsHint = "Team instructions: each is averaged on a club's real XI, and the past seasons don't hold each player's club yet, so none is tested.";
export const instructionColumns = {
  instruction: { short: "Instruction", long: "Team instruction" },
  average: { short: "Avg", long: "Average for a whole XI" },
} as const;
/** A team instruction whose stats were all copied, still untested as no club's XI is held. */
export const notTestedYetWords = "Not tested";

/** The banner, from a patch's announcement until it takes effect. */
export const bannerWords = (name: string, takesEffectAt: number) => `Scoring patch ${name} takes effect on ${screenMoment(takesEffectAt)}.`;
export const dismissWords = "Dismiss";
/** What a dismissal that failed left. */
export const dismissFailedWords = failedWords("the banner wasn't dismissed");
