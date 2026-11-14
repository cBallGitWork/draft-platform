// Fuzzing a typed input (#2129): random text from a fixed seed, so a failing case comes back the same
// on every run. Only what the spec settles is drawn: plain keyboard characters, spaces, tabs and line
// breaks. Emoji, byte-order marks and `;` are left out until a /grill settles them.

import { seededRandom } from "../../../convex/table/roundRobin";

/** How many random texts each fuzz test tries. */
export const FUZZ_RUNS = 500;

/** Letters, digits, punctuation, a comma and the white space a keyboard or a spreadsheet types. */
const TYPED = "abcxyzABCXYZ0123456789 .,'-_!?()&\t\n\r";

/** A random pick from a seeded draw. */
export const pickFrom = <Item>(random: () => number, items: readonly Item[]): Item => items[Math.floor(random() * items.length)];

/** `FUZZ_RUNS` random typed texts from `seed`, each 0 to `longest` characters. */
export function fuzzedTexts(seed: string, longest: number): string[] {
  const random = seededRandom(seed);
  return Array.from({ length: FUZZ_RUNS }, () =>
    Array.from({ length: Math.floor(random() * (longest + 1)) }, () => pickFrom(random, [...TYPED])).join(""),
  );
}
