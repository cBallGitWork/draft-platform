import { describe, expect, test } from "vitest";
import { matchdayAt, matchdays, type MatchdayMatch } from "../../../convex/home/matchday";
import { LIVE_WINDOW_MS } from "../../../convex/stats/liveStats";
import { HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";

// League home's matchday mode (spec/12, League home): from 3 hours before a matchday's first
// kickoff to 2 after its last final whistle; a matchday is one UK calendar day with matches, and
// overlapping ones join (Craig, 6 Nov 2026, #387).

const MARGINS = { beforeMs: 3 * HOUR_MS, afterMs: 2 * HOUR_MS };
const FULL_TIME_AFTER = 115 * MINUTE_MS;
const at = (iso: string) => Date.parse(iso);
const match = (fixtureCode: number, kickoff: string, played = true): MatchdayMatch => ({
  fixtureCode,
  kickoff: at(kickoff),
  fullTimeAt: played ? at(kickoff) + FULL_TIME_AFTER : null,
});

// A gameweek from Saturday 12:30 to Monday 20:00, UK time (GMT in November).
const SATURDAY_EARLY = match(1, "2026-11-07T12:30:00Z");
const SATURDAY_LATE = match(2, "2026-11-07T17:30:00Z");
const SUNDAY = match(3, "2026-11-08T14:00:00Z");
const MONDAY = match(4, "2026-11-09T20:00:00Z");

describe("the matchdays", () => {
  test("a Saturday to Monday gameweek has three, each from 3 hours before its first kickoff to 2 after its last final whistle", () => {
    expect(matchdays([MONDAY, SATURDAY_LATE, SUNDAY, SATURDAY_EARLY], MARGINS)).toEqual([
      { start: at("2026-11-07T09:30:00Z"), end: at("2026-11-07T17:30:00Z") + FULL_TIME_AFTER + 2 * HOUR_MS, fixtureCodes: [2, 1] },
      { start: at("2026-11-08T11:00:00Z"), end: at("2026-11-08T14:00:00Z") + FULL_TIME_AFTER + 2 * HOUR_MS, fixtureCodes: [3] },
      { start: at("2026-11-09T17:00:00Z"), end: at("2026-11-09T20:00:00Z") + FULL_TIME_AFTER + 2 * HOUR_MS, fixtureCodes: [4] },
    ]);
  });

  test("a late kickoff and the next day's early one overlap, so they join into one", () => {
    const late = match(5, "2026-11-07T20:00:00Z");
    const early = match(6, "2026-11-08T01:30:00Z");
    expect(matchdays([late, early], MARGINS)).toEqual([
      { start: at("2026-11-07T17:00:00Z"), end: at("2026-11-08T01:30:00Z") + FULL_TIME_AFTER + 2 * HOUR_MS, fixtureCodes: [5, 6] },
    ]);
  });

  test("the day is the UK's: 23:30 UK time in summer is the next day in UTC terms, but the same day here", () => {
    const evening = match(7, "2026-08-22T17:00:00Z");
    const lateBst = match(8, "2026-08-22T22:30:00Z"); // 23:30 BST, Saturday
    expect(matchdays([evening, lateBst], { beforeMs: 0, afterMs: 0 }).map((day) => day.fixtureCodes)).toEqual([[7, 8]]);
  });

  test("a match with no time is on no matchday", () => {
    expect(matchdays([{ fixtureCode: 9, kickoff: null, fullTimeAt: null }], MARGINS)).toEqual([]);
  });

  test("a match not yet at full time holds its day open to the live tick's horizon, no further", () => {
    const [day] = matchdays([match(10, "2026-11-07T15:00:00Z", false)], MARGINS);
    expect(day.end).toBe(at("2026-11-07T15:00:00Z") + LIVE_WINDOW_MS + 2 * HOUR_MS);
  });
});

describe("the matchday open now", () => {
  const gameweek = [SATURDAY_EARLY, SATURDAY_LATE, SUNDAY, MONDAY];

  test("opens 3 hours before the first kickoff, not a minute sooner", () => {
    expect(matchdayAt(gameweek, MARGINS, at("2026-11-07T09:29:00Z"))).toBeNull();
    expect(matchdayAt(gameweek, MARGINS, at("2026-11-07T09:30:00Z"))?.fixtureCodes).toEqual([1, 2]);
  });

  test("closes 2 hours after the last final whistle, and the home is quiet until the next", () => {
    const close = at("2026-11-07T17:30:00Z") + FULL_TIME_AFTER + 2 * HOUR_MS;
    expect(matchdayAt(gameweek, MARGINS, close - 1)).not.toBeNull();
    expect(matchdayAt(gameweek, MARGINS, close)).toBeNull();
    expect(matchdayAt(gameweek, MARGINS, at("2026-11-08T12:00:00Z"))?.fixtureCodes).toEqual([3]);
  });
});
