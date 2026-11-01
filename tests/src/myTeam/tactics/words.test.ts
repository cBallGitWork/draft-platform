// The Tactics tab's countdown to the deadline (#14): the two largest units, a minute at a time.

import { expect, it } from "vitest";
import { DAY_MS, HOUR_MS, MINUTE_MS, SECOND_MS } from "../../../../convex/shared/time";
import { countdownWords } from "../../../../src/myTeam/header/words";

it.each([
  [DAY_MS + 17 * HOUR_MS + 5 * MINUTE_MS, "in 1d 17h"],
  [5 * HOUR_MS + 12 * MINUTE_MS, "in 5h 12m"],
  [12 * MINUTE_MS + 30 * SECOND_MS, "in 12m"],
  [30 * SECOND_MS, "in under a minute"],
])("counts %d ms down as %s", (left, words) => {
  expect(countdownWords(left)).toBe(words);
});
