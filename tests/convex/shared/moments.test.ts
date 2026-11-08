import { expect, test } from "vitest";
import { andListWords, londonOffset } from "../../../convex/shared/moments";

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

// UK time is UTC in winter and an hour ahead in summer, turning at 01:00 UTC on the clocks' Sundays.
test.each<[string, number]>([
  ["2026-01-15T12:00:00.000Z", 0],
  ["2026-07-15T12:34:56.789Z", 60 * 60 * 1000],
  ["2026-03-29T00:59:59.000Z", 0],
  ["2026-03-29T01:00:00.000Z", 60 * 60 * 1000],
  ["2026-10-25T00:59:59.000Z", 60 * 60 * 1000],
  ["2026-10-25T01:00:00.000Z", 0],
])("UK time is ahead of UTC at %s by %i ms", (at, offset) => {
  expect(londonOffset(Date.parse(at))).toBe(offset);
});
