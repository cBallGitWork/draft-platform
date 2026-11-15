// Fuzzing a typed input (#2129): random text from a fixed seed, so a failing case comes back the same
// on every run. Drawn: keyboard characters, spaces, tabs, line breaks, `;` (S04.23) and emoji, a
// single one and those of several code points that look like one (a flag, a skin tone, a family;
// S13.2; #2141). The ranking file's tests add Excel's byte-order mark themselves.

import { seededRandom } from "../../../convex/table/roundRobin";
import { EMOJI } from "./test.harness";

/** How many random texts each fuzz test tries. */
export const FUZZ_RUNS = 500;

/** Emoji of several code points that each look like one character: a flag, a thumb with a skin
 *  tone, a family. */
export const LOOKS_LIKE_ONE = ["\u{1F1EC}\u{1F1E7}", "\u{1F44D}\u{1F3FD}", "\u{1F468}‍\u{1F469}‍\u{1F467}"];

/** Letters, digits, punctuation, a comma and a semicolon, the white space a keyboard or a
 *  spreadsheet types, and emoji. */
const TYPED = [..."abcxyzABCXYZ0123456789 .,;'-_!?()&\t\n\r", EMOJI, ...LOOKS_LIKE_ONE];

/** A random pick from a seeded draw. */
export const pickFrom = <Item>(random: () => number, items: readonly Item[]): Item => items[Math.floor(random() * items.length)];

/** `FUZZ_RUNS` random typed texts from `seed`, each 0 to `longest` picks (an emoji is one pick). */
export function fuzzedTexts(seed: string, longest: number): string[] {
  const random = seededRandom(seed);
  return Array.from({ length: FUZZ_RUNS }, () =>
    Array.from({ length: Math.floor(random() * (longest + 1)) }, () => pickFrom(random, TYPED)).join(""),
  );
}
