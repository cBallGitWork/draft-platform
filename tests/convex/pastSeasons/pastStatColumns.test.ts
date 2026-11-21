import { expect, test } from "vitest";
import { STAT_COLUMNS } from "../../../convex/pastSeasons/pastSeasonRows";
import { NOT_TESTED, PAST_FEEDS, PAST_STAT_COLUMNS } from "../../../convex/pastSeasons/pastStatColumns";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { CATALOGUE_STATS } from "../../../convex/scoring/statCatalogue";

// spec/14, The rule balance lab: each category takes its nearest column in the past seasons' log,
// and one with none is "not tested" (#842).

const mapped = Object.keys(PAST_STAT_COLUMNS);

test("every catalogue stat is mapped to a column or marked not tested, so a new stat waits on a decision", () => {
  const decided = [...mapped, ...NOT_TESTED];
  expect(new Set(decided).size, "a stat is in both lists, or twice in one").toBe(decided.length);
  expect([...decided].sort()).toEqual([...CATALOGUE_STATS].sort());
});

test("every stat the first scoring set prices is copied, so none of today's rules is untested", () => {
  const priced = new Set(FIRST_SCORING.rules.map((rule) => rule.stat));
  expect([...priced].filter((stat) => !(stat in PAST_STAT_COLUMNS))).toEqual([]);
});

test("each mapped stat names one of the log's feeds, and no two stats share a column", () => {
  expect(Object.values(PAST_STAT_COLUMNS).every(({ feed }) => PAST_FEEDS.includes(feed))).toBe(true);
  const columns = Object.values(PAST_STAT_COLUMNS).map(({ column }) => column);
  expect(new Set(columns).size).toBe(columns.length);
});

test("the copy reads each mapped stat from its column", () => {
  expect(STAT_COLUMNS).toEqual(Object.fromEntries(mapped.map((stat) => [stat, PAST_STAT_COLUMNS[stat].column])));
});
