import { expect, test } from "vitest";
import { andListWords } from "../../../convex/shared/moments";

// The English list every letter, table line and lineup refusal is written with.

test.each<[string[], string]>([
  [[], ""],
  [["A"], "A"],
  [["A", "B"], "A and B"],
  [["A", "B", "C"], "A, B and C"],
  [["A", "B", "C", "D"], "A, B, C and D"],
])("%o reads %o", (items, words) => {
  expect(andListWords(items)).toBe(words);
});
