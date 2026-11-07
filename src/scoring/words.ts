// What Player scoring and the rules editor say, in one place for Craig to change in the pull
// request. Why the server refused a change is in convex/scoring/siteScoring.ts
// (`siteScoringRefusals`, and the scoring set's reasons in convex/scoring/scoringSet.ts), and
// reaches the screen as is.

import { SLOT_POSITIONS, type SlotPosition } from "../../convex/lineup/pitch";
import { screenMoment } from "../../convex/shared/moments";
import { gameweekWords, noNumberWords, savedFromWords } from "../rules/words";
import { failedWords, figureWords, POSITION_NAMES } from "../shared/words";
import type { PerCount, Pricing, Shape } from "./editing";

export const SCORING_TITLE = "Player scoring";
export const categoriesLabel = "Categories";
export const loadingWords = "Loading the scoring…";
/** Under the panes for everyone but the admin (spec/14, Who owns it). */
export const readOnlyWords = "Only the admin changes the scoring.";
export const wholePointsReadWords = "Points are whole only.";
export const fractionsReadWords = "Points can be fractions, such as 0.5 a tackle.";

/** The left pane's summary of a category's values, beside its name. */
export const pricingWords: Record<Exclude<Pricing, "all">, string> = { byArea: "By area", byPosition: "By position" };
export const bandsWords = "Bands";
/** "1 per 3", for a per-number rule the same for all. */
export const perCountSummary = ({ points, every }: PerCount) => `${pointsWords(points)} per ${every}`;

/** A number of points as the editor shows it outside a box. */
export const pointsWords = figureWords;

export const addCategoryWords = "Add a category";
export const addCategoryLabel = "Category to add";
export const addWords = "Add";
export const allScoredWords = "Every stat already has a category.";
export const removeCategoryWords = "Remove this category";

/** Making an own stat (spec/14, Own stats): catalogue stats added up, each with a weight. */
export const makeOwnStatWords = "Make a stat of your own";
export const ownStatNameLabel = "Name";
export const ownStatShortCodeLabel = "Short code";
/** Each part's boxes, for screen readers: "Stat 2", "Weight of stat 2". */
export const partStatLabel = (part: number) => `Stat ${part}`;
export const partWeightLabel = (part: number) => `Weight of stat ${part}`;
export const removePartLabel = (part: number) => `Remove stat ${part}`;
export const removePartWords = "×";
export const addPartWords = "Add a stat";
export const makeWords = "Make it";
export const cancelWords = "Cancel";
/** Why an own stat as typed can't be made yet. */
export const ownStatProblemWords = {
  name: "Give it a name.",
  shortCode: "Give it a short code.",
  parts: "Add at least one stat.",
  weight: "Each stat needs a weight.",
} as const;

export const shapeLabel = "Points";
export const shapeWords: Record<Shape, string> = { perAction: "Per action", perCount: "Per number", bands: "Bands" };
export const shapeHints: Record<Shape, string> = {
  perAction: "Points for each one he makes.",
  perCount: "Points for every so many he makes.",
  bands: "Points for reaching a number, such as 60 minutes.",
};
export const byAreaWords = "Different by area";
export const byPositionWords = "Different by position (FB, CB, CDM…)";
export const stackWords = "He earns every band he reaches, not only the highest";
export const limitWords = "Points limit: at most, at least";
export const minutesWords = "Earned only after a number of minutes";
export const limitHint = "Leave either box empty for no limit at that end.";

/** The values table's columns, and each box's own name for screen readers. */
export const columnWords = {
  area: "Area",
  position: "Position",
  points: "Points",
  every: "For every",
  bands: "Bands",
  max: "At most",
  min: "At least",
  minutes: "After minutes",
} as const;
export const everyoneWords = "Everyone";
/** A box's name for screen readers: "Points, Defence". */
export const boxLabel = (column: string, row: string) => `${column}, ${row}`;

export const bandFromWords = "From";
export const bandEarnsWords = "earns";
export const addBandWords = "Add a band";
/** A band's row, for its boxes' names: "Goalkeeper, band 2". */
export const bandRowWords = (row: string, band: number) => `${row}, band ${band}`;
export const removeBandWords = "×";
export const removeBandLabel = (bandRow: string) => `Remove ${bandRow}`;
export const noBandsWords = "No bands: earns nothing.";

/** Each slot position by its name and code, as "Centre-back (CB)". */
export const POSITION_WORDS = Object.fromEntries(
  SLOT_POSITIONS.map((position) => [position, `${POSITION_NAMES[position]} (${position})`]),
) as Record<SlotPosition, string>;

/** The bottom bar. */
export const wholePointsWords = "Whole points only";
export const savedWords = (gameweek: number) => savedFromWords("The new scoring applies to every league", gameweek);
/** Worded as League settings words an empty box (#351). */
export const blankBoxWords = (category: string) => noNumberWords(`A box in ${category}`);

/** What a failed save leaves, live or in the preview. */
export const unsavedOutcome = "the scoring didn't change";
export const saveFailedWords = failedWords(unsavedOutcome);

/** The admin's patches (spec/14, Changes and corrections; Craig, 6 Nov 2026, on #368): the editor's
 *  two tabs, the live set saved as a fix and the draft patch, announced from a gameweek. */
export const editorTabsLabel = "Which scoring you edit";
export const liveTabWords = "Live";
export const draftTabWords = "Draft patch";
export const saveDraftWords = "Save draft";
export const draftSavedWords = "Draft saved. It changes nothing until announced.";
export const announceGameweekLabel = "Takes effect from";
/** "Gameweek 13, Sat 21 Nov, 12:30". */
export const patchGameweekWords = (gameweek: number, takesEffectAt: number) => `${gameweekWords(gameweek)}, ${screenMoment(takesEffectAt)}`;
export const announceWords = "Announce";
export const announcedWords = (name: string, gameweek: number) => `Announced. Patch ${name} applies to every league from ${gameweekWords(gameweek)}.`;
export const saveDraftFirstWords = "Save the draft to announce it.";
/** The server offers only gameweeks a patch's week of notice reaches (convex/scoring/siteVersions.ts). */
export const noPatchGameweekWords = "No gameweek is far enough off for a patch's notice.";
export const draftFailedWords = failedWords("the draft wasn't saved");
export const announceFailedWords = failedWords("the patch wasn't announced");
/** The rule balance lab on the draft patch (spec/14; #843): run on the saved draft, saving nothing. */
export const runLabWords = "Run the lab";
export const runningLabWords = "Running the lab on the past seasons…";
export const saveDraftToRunLabWords = "Save the draft to run the lab on it.";
export const labFailedWords = failedWords("the lab didn't run");

/** The versions list. */
export const versionsTitle = "Versions";
export const versionColumns = {
  name: { short: "Version", long: "Version" },
  kind: { short: "Kind", long: "Patch or fix" },
  announcedAt: { short: "Announced", long: "Announced on" },
  fromGameweek: { short: "From", long: "Takes effect from" },
  notes: { short: "Notes", long: "Patch notes" },
} as const;
export const comingWords = "Coming";
export const noVersionsYetWords = "No versions yet: every league plays the first scoring set.";
export const notesLinkWords = "Notes";
export const withdrawWords = "Withdraw";
export const withdrawQuestion = (name: string) => `Withdraw patch ${name}? It goes back to the draft, its banner goes, and every manager gets a letter saying so.`;
export const withdrawYesWords = "Withdraw it";
export const withdrawNoWords = "Keep it";
export const withdrawFailedWords = failedWords("the patch wasn't withdrawn");
