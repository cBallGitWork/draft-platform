// What Player scoring and the rules editor say, in one place for Craig to change in the pull
// request. Why the server refused a change is in convex/scoring/siteScoring.ts
// (`siteScoringRefusals`, and the scoring set's reasons in convex/scoring/scoringSet.ts), and
// reaches the screen as is.

import { SLOT_POSITIONS, type SlotPosition } from "../../convex/lineup/pitch";
import { failedWords, gameweekWords, POSITION_NAMES } from "../words";
import type { PerCount, Pricing, Shape } from "./editing";

export const SCORING_TITLE = "Player scoring";
export const categoriesLabel = "Categories";
export const loadingWords = "Loading the scoring…";
/** Under the panes for everyone but the admin (spec/14, Who owns it). */
export const readOnlyWords = "The site sets the scoring for every league. Only the admin changes it.";
export const wholePointsReadWords = "Points are whole only.";
export const fractionsReadWords = "Points can be fractions, such as 0.5 a tackle.";

/** The left pane's summary of a category's values, beside its name. */
export const pricingWords: Record<Exclude<Pricing, "all">, string> = { byArea: "By area", byPosition: "By position" };
export const bandsWords = "Bands";
/** "1 per 3", for a per-number rule the same for all. */
export const perCountSummary = ({ points, every }: PerCount) => `${pointsWords(points)} per ${every}`;

/** A number of points as the editor shows it outside a box: a minus sign, not a hyphen. */
export const pointsWords = (points: number) => (points < 0 ? `−${-points}` : String(points));

export const addCategoryWords = "Add a category";
export const addCategoryLabel = "Category to add";
export const addWords = "Add";
export const allScoredWords = "Every stat in the catalogue already has a category.";
export const removeCategoryWords = "Remove this category";

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
export const savedWords = (gameweek: number) => `Saved. The new scoring applies to every league from ${gameweekWords(gameweek)}.`;
export const blankBoxWords = (category: string) => `${category} has a box without a number. Fill it in, then save.`;

/** What a failed save leaves, live or in the preview. */
export const unsavedOutcome = "the scoring didn't change";
export const saveFailedWords = failedWords(unsavedOutcome);
