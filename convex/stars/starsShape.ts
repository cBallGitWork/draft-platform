import { v, type Infer } from "convex/values";
import { areaShape } from "../lineup/pitchShape";

// A rating's values and validators, apart from stars.ts so the schema and the browser read them
// without loading the scorer (as scoring/scoringSetShape.ts is, #756).

/** Shown "?": he has played, but too few matches to be sure (spec/05). */
export const UNSURE = "unsure";
/** Shown "—": no counted match at all, as a new signing (spec/05). */
export const NO_DATA = "none";

/** A rating: a number of stars, half a star to five in half-star steps, or one of the two unrated
 *  values. */
export const starsShape = v.union(v.number(), v.literal(UNSURE), v.literal(NO_DATA));
export type Stars = Infer<typeof starsShape>;

/** One of his ratings: the role in one area, since a role offered in two areas, the shadow
 *  striker's, is rated in each apart (Craig, 1 Nov 2026). */
export const roleStarsShape = v.object({ area: areaShape, role: v.string(), stars: starsShape });
export type RoleStars = Infer<typeof roleStarsShape>;
