import { expect, test } from "vitest";
import { addStats, sumStats } from "../../../convex/stats/statTotals";

// A player's match stats added up (#373): what a stat either side leaves out counts, and that sums
// of decimals stay exact.

test("stats add up by name, a stat one side leaves out counting 0", () => {
  expect(sumStats([{ goals_scored: 1, minutes: 90 }, { minutes: 64, assists: 1 }])).toEqual({ goals_scored: 1, minutes: 154, assists: 1 });
});

test("nothing to add up is no stats", () => {
  expect(sumStats([])).toEqual({});
});

test("taking a record's stats away undoes adding them, leaving no total of 0 behind", () => {
  const totals = { expected_goals: 1.14 };
  const record = { goals_scored: 3, expected_goals: 0.43, minutes: 0 };
  expect(addStats(addStats(totals, record), record, -1)).toEqual({ expected_goals: 1.14 });
});

test("decimals add up exactly, without floating-point dust", () => {
  expect(sumStats([{ expected_goals: 0.1 }, { expected_goals: 0.2 }])).toEqual({ expected_goals: 0.3 });
  expect(addStats({ expected_goals: 0.3 }, { expected_goals: 0.1 }, -1)).toEqual({ expected_goals: 0.2 });
});
