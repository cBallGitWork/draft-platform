// Team instructions in words (spec/05, Team instructions; #990): what each shape need asks for, the
// line a formation change leaves when it switches a pick, and a save's refusal of a pair.

import type { Instruction, ShapeNeed, Side, Switched } from "./instructions";

/** What each need asks of a formation, as "Park the bus needs …" ends. */
const NEEDS_WORDS: Record<ShapeNeed, string> = {
  anyShape: "any formation",
  oneUpTopNoWingers: "one up top and no wingers",
  wideOnBothFlanks: "wide players on both flanks",
  twoAtTheBack: "2 at the back",
  threeInARow: "3 or more in one row of midfield or attack",
  backThreeOrFour: "3 or 4 at the back",
  fiveAtTheBack: "5 at the back",
};

/** The line under the toolbar after a formation change switched picks (spec/05: "Park the bus needs
 *  5 at the back: switched to Keep it tight early"); null when none switched. */
export function switchedWords(switched: readonly Switched[]): string | null {
  if (switched.length === 0) return null;
  return switched.map(({ from, to }) => `${from.name} needs ${NEEDS_WORDS[from.needs]}: switched to ${to.name}`).join(". ");
}

/** Why a saved pair is refused: a key the league's set doesn't hold on that side, or one the
 *  lineup's shape blocks. */
export function pairRefusalWords(refusal: { side: Side; key: string; blockedBy?: ShapeNeed }, set: readonly Instruction[]): string {
  const name = set.find(({ key }) => key === refusal.key)?.name;
  if (refusal.blockedBy === undefined || name === undefined) return `"${refusal.key}" isn't one of this league's ${refusal.side} instructions.`;
  return `${name} needs ${NEEDS_WORDS[refusal.blockedBy]}, which this lineup's formation doesn't have.`;
}
