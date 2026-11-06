import { describe, expect, test } from "vitest";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { MINUTE_MS } from "../../../convex/shared/time";
import { latestRunAt } from "../../../convex/waivers/waiverTimes";

// When waivers run (#1198; spec/03, spec/08): Wednesday and Thursday at 18:00 UK time by default,
// whatever the clocks say, winter or summer.

const RUNS = FIRST_RULES.waivers.runs;

describe("a new league's waiver runs", () => {
  test("are Wednesday and Thursday at 18:00 UK time", () => {
    expect(RUNS).toEqual([
      { day: "wednesday", hour: 18, minute: 0 },
      { day: "thursday", hour: 18, minute: 0 },
    ]);
  });
});

describe("the latest run", () => {
  test("in winter, UK time is UTC: Wednesday 18:00 is 18:00 UTC", () => {
    // Wednesday 13 January 2027.
    const wednesday = Date.UTC(2027, 0, 13, 18, 0);
    expect(latestRunAt(RUNS, wednesday)).toBe(wednesday);
    expect(latestRunAt(RUNS, wednesday + 3 * MINUTE_MS)).toBe(wednesday);
    // A minute before it, the latest is last Thursday's.
    expect(latestRunAt(RUNS, wednesday - MINUTE_MS)).toBe(Date.UTC(2027, 0, 7, 18, 0));
  });

  test("in summer, UK time is an hour ahead: Thursday 18:00 is 17:00 UTC", () => {
    // Thursday 19 August 2027.
    const thursday = Date.UTC(2027, 7, 19, 17, 0);
    expect(latestRunAt(RUNS, thursday)).toBe(thursday);
    expect(latestRunAt(RUNS, thursday - MINUTE_MS)).toBe(Date.UTC(2027, 7, 18, 17, 0));
    // Through the weekend, it is still Thursday's.
    expect(latestRunAt(RUNS, Date.UTC(2027, 7, 23, 9, 0))).toBe(thursday);
  });

  test("a league's own runs: Tuesday at 09:30 only", () => {
    const tuesday = Date.UTC(2027, 0, 12, 9, 30);
    expect(latestRunAt([{ day: "tuesday", hour: 9, minute: 30 }], tuesday + 6 * 24 * 60 * MINUTE_MS)).toBe(tuesday);
  });

  test("none with no runs", () => {
    expect(latestRunAt([], Date.UTC(2027, 0, 12))).toBeNull();
  });
});
