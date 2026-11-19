import { describe, expect, test } from "vitest";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { DAY_MS, MINUTE_MS, WEEK_MS } from "../../../convex/shared/time";
import type { Id } from "../../../convex/_generated/dataModel";
import type { RulesRow } from "../../../convex/rules/rulesHistory";
import { firstRunFrom, latestRunAt, wasRunTime } from "../../../convex/waivers/waiverTimes";

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
    expect(latestRunAt([{ day: "tuesday", hour: 9, minute: 30 }], tuesday + 6 * DAY_MS)).toBe(tuesday);
  });

  test("none with no runs", () => {
    expect(latestRunAt([], Date.UTC(2027, 0, 12))).toBeNull();
  });
});

describe("the first run that can take a player (#1200)", () => {
  test("dropped Tuesday at 19:00, he is claimable Wednesday at 19:00, so Thursday's run first takes him", () => {
    // Wednesday 13 January 2027, winter: UK time is UTC.
    expect(firstRunFrom(RUNS, Date.UTC(2027, 0, 13, 19, 0))).toBe(Date.UTC(2027, 0, 14, 18, 0));
  });

  test("a run at the very moment he is claimable takes him", () => {
    const wednesday = Date.UTC(2027, 0, 13, 18, 0);
    expect(firstRunFrom(RUNS, wednesday)).toBe(wednesday);
  });

  test("in summer, just past Thursday's run, it is next Wednesday's, 17:00 UTC", () => {
    expect(firstRunFrom(RUNS, Date.UTC(2027, 7, 19, 17, 1))).toBe(Date.UTC(2027, 7, 25, 17, 0));
  });

  test("a league's one weekly run, just missed, is a week on", () => {
    const tuesday = Date.UTC(2027, 0, 12, 9, 30);
    expect(firstRunFrom([{ day: "tuesday", hour: 9, minute: 30 }], tuesday + MINUTE_MS)).toBe(tuesday + WEEK_MS);
  });

  test("none with no runs", () => {
    expect(firstRunFrom([], Date.UTC(2027, 0, 12))).toBeNull();
  });
});

describe("whether a moment was a run time", () => {
  // Gameweek 9's deadline is Saturday 9 January 2027, 11:00, and gameweek 10's a week on. On
  // Monday of gameweek 9 the commissioner moves the runs to Friday 10:00, from gameweek 10.
  const leagueId = "league" as Id<"leagues">;
  const deadlines = new Map([
    [9, Date.UTC(2027, 0, 9, 11, 0)],
    [10, Date.UTC(2027, 0, 16, 11, 0)],
  ]);
  const row = (at: number, fromGameweek: number, runs: typeof RUNS): RulesRow => ({
    _id: `rules${at}` as Id<"leagueRules">,
    _creationTime: at,
    leagueId,
    fromGameweek,
    rules: { ...FIRST_RULES, waivers: { ...FIRST_RULES.waivers, runs } },
  });
  const history = [row(Date.UTC(2027, 0, 1), 1, RUNS), row(Date.UTC(2027, 0, 11, 12, 0), 10, [{ day: "friday", hour: 10, minute: 0 }])];
  const wasRun = (at: number) => wasRunTime(history, leagueId, deadlines, at);

  test("S03.11 a run time saved mid-gameweek runs only from the next deadline, the old ones until it", () => {
    expect(wasRun(Date.UTC(2027, 0, 13, 18, 0))).toBe(true);
    expect(wasRun(Date.UTC(2027, 0, 15, 10, 0))).toBe(false);
    expect(wasRun(Date.UTC(2027, 0, 20, 18, 0))).toBe(false);
    expect(wasRun(Date.UTC(2027, 0, 22, 10, 0))).toBe(true);
  });

  test("S08.10 none before the league's rules were saved", () => {
    expect(wasRun(Date.UTC(2026, 11, 30, 18, 0))).toBe(false);
  });
});
