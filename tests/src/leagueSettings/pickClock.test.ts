// The pick clock's units on League settings (#1087): the rules hold seconds, the screen a unit.

import { expect, test } from "vitest";
import { inUnit, toSeconds, unitFor } from "../../../src/leagueSettings/pickClock";

test.each([
  [90, "seconds"],
  [120, "minutes"],
  [8 * 3600, "hours"],
  [5400, "minutes"],
  [NaN, "seconds"],
] as const)("%s seconds opens in %s", (seconds, unit) => {
  expect(unitFor(seconds)).toBe(unit);
});

test("a clock is read in its unit and saved back in seconds, a tenth of an hour as 360 exactly", () => {
  expect(inUnit(90, "minutes")).toBe(1.5);
  expect(toSeconds(1.5, "minutes")).toBe(90);
  expect(toSeconds(0.1, "hours")).toBe(360);
  expect(toSeconds(NaN, "hours")).toBeNaN();
});
