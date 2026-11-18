// What the scoring changes banner and page say (a patch is "scoring changes" on screen; Craig, 18 Nov 2026), in one place for Craig to change in the pull
// request. What each version changed is worked out on the server (convex/scoring/patchChanges.ts),
// and reaches the screen as is.

import { LOCALE, screenMoment } from "../../convex/shared/moments";
import { ROLE_TARGET_MARGIN } from "../../convex/balanceLab/balanceLabLimits";
import { failedWords, thousandsWords } from "../shared/words";
import { seasonShortWords } from "../shared/when/words";
import type { LabReport } from "../../convex/balanceLab/labReportShape";
import type { VersionNotes } from "./seam";

type PastStarter = NonNullable<LabReport["noPosition"]>["first"][number];

export const PATCH_NOTES_TITLE = "Scoring changes";
/** The banner's link, and Player scoring's, to the page. */
export const patchNotesLinkWords = PATCH_NOTES_TITLE;
export const loadingWords = "Loading the scoring changes…";
export const noVersionsWords = "No scoring changes yet.";
export const notesHint = "Gameweeks played before a version keep the scoring they had.";

/** Whether a version is planned changes or a fix, on the page and the admin's list. Its stored name
 *  (26_27.2) stays off a manager's screen: the date says which set (Craig, 18 Nov 2026). */
export const KIND_WORDS: Record<VersionNotes["kind"], string> = { patch: "Changes", fix: "Fix" };
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
  return `On ${on}: ${thousandsWords(starts)} real starts, each in the formation position he started in. ${thousandsWords(skipped)} skipped, as they fit none.`;
};
export const labHint = `Each role's average per start in its formation position, against that position's target role adjustment. Flagged if more than ${ROLE_TARGET_MARGIN} off.`;
export const labColumns = {
  role: { short: "Role", long: "Role" },
  slot: { short: "Pos", long: "Formation position" },
  target: { short: "Target", long: "Target role adjustment per start" },
  average: { short: "Avg", long: "Average per start" },
  starts: { short: "Starts", long: "Starts tested on" },
} as const;
export const offTargetWords = "Off target";
/** A role scoring a stat the past seasons weren't copied with (Craig, 7 Nov 2026, on #843). */
export const notTestedWords = (stats: readonly string[]) => `Not tested: no past ${stats.join(", ")}`;
export const noStartsWords = "No starts";
export const noRolesWords = "The set scores no roles.";
const pastDayFormat = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" });
/** One past starter flagged with no position: his name, his club and the day of the match, e.g.
 *  "Ben Mee, Brentford, 4 Mar 2023"; a row copied before #1541 has no club. */
const pastStarterWords = ({ name, club, kickoff }: PastStarter) => [name, ...(club === undefined ? [] : [club]), pastDayFormat.format(kickoff)].join(", ");
/** Past starters whose match gives no position the pitch has, so each is given none (spec/14
 *  S14.25; Craig, 13 Nov 2026, on #1541): the count, and the first ones named. */
export const noPositionWords = (count: number, first: readonly PastStarter[]) =>
  `Players who started past matches with no position: ${thousandsWords(count)}${first.length === 0 ? "." : `. First ${first.length}: ${first.map(pastStarterWords).join("; ")}.`}`;
/** The set scores no team instructions (spec/05 Team instructions), so none are checked. */
export const noTeamInstructionsWords = "The set scores no team instructions.";
/** How a team instruction is tested (spec/14 S14.9; Craig, 12 Nov 2026, on #1541): over the clubs'
 *  real XIs, "XIs short of a starter" where one starter's position maps to no slot or his row
 *  wasn't copied. */
export const instructionsHint = (xis: number, short: number) =>
  `Each team instruction's average for a whole XI over a full match, across every club's real XIs in a formation that allows it. XIs tested: ${thousandsWords(xis)}. Short of a player, scored on the rest: ${thousandsWords(short)}.`;
/** A report kept before the averages (#1541): its instructions are each "not tested". */
export const instructionsUntestedHint = "No team instructions were tested when this report was saved.";
export const instructionColumns = {
  instruction: { short: "Instruction", long: "Team instruction" },
  average: { short: "Avg", long: "Average for a whole XI" },
  xis: { short: "XIs", long: "XIs tested on" },
} as const;
/** A team instruction with its stats all copied, on a report kept before the averages (#1541). */
export const notTestedYetWords = "Not tested";
/** A team instruction no past XI was tested on: none in a shape it allows, or no club copied yet. */
export const noXisWords = "No XIs";

/** The banner, from a patch's announcement until it takes effect: "Scoring changes from Sunday 1
 *  November at noon GMT." */
export const bannerWords = (takesEffectAt: number) => `Scoring changes from ${screenMoment(takesEffectAt)}.`;
export const dismissWords = "Dismiss";
/** What a dismissal that failed left. */
export const dismissFailedWords = failedWords("the banner wasn't dismissed");
