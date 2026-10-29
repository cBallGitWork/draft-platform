// A match's score on the Premier League pages (spec/18, spec/10): the goals once it has kicked off
// and both are read, else nothing, so the page shows "v".

import { expect, it } from "vitest";
import { goalsWords, scoreWords } from "../../../src/premierLeague/words";

it.each([
  ["upcoming", null, null],
  ["upcoming", 0, 0],
  ["live", null, 1],
  ["halfTime", 2, null],
])("shows no score for a %s match with goals %s–%s", (state, homeGoals, awayGoals) => {
  expect(goalsWords({ state, homeGoals, awayGoals })).toBeNull();
});

it("shows no score when there is none", () => {
  expect(goalsWords(null)).toBeNull();
});

it.each([
  ["live", 0, 0],
  ["halfTime", 1, 0],
  ["fullTime", 2, 1],
])("shows a %s match's goals %d–%d as the score", (state, homeGoals, awayGoals) => {
  expect(goalsWords({ state, homeGoals, awayGoals })).toBe(scoreWords(homeGoals, awayGoals));
});
