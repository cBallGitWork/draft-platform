import type { CardMatch } from "../../../../convex/lineup/roleCardShape";
import { inTenths } from "../../../../convex/scoring/values";
import { figureWords, signedWords } from "./words";

// The role card's sums over his matches (#848), which the roles' table, the preview's aside and
// the matches' totals all read, so the three never disagree.

/** A role's totals over his matches: what it added, and his points with it. */
export function sumsOf(matches: readonly CardMatch[], role: string) {
  const under = matches.map((match) => match.roles.find((each) => each.role === role)!);
  return { points: sum(under.map(({ points }) => points)), total: sum(under.map(({ total }) => total)) };
}

/** His base points over his matches. */
export const baseOf = (matches: readonly CardMatch[]) => sum(matches.map(({ base }) => base));

/** Points are kept in tenths (spec/14), so their sum is too. */
const sum = (numbers: readonly number[]) => inTenths(numbers.reduce((total, each) => total + each, 0));

/** A role's points, signed, or 0 bare: "+3", "−1", "0". */
export const signedOrNothing = (points: number) => (points === 0 ? figureWords(0) : signedWords(points));
