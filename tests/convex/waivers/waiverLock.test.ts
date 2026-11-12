import { describe, expect, test } from "vitest";
import { DAY_MS, HOUR_MS } from "../../../convex/shared/time";
import { firstRunTaking, mayFallInLock } from "../../../convex/waivers/waiverLock";

// The waiver lock's forecast of a run (#1198, spec/08), pure: whether a run may fall in a
// gameweek's lock, and the run that can first take a player on waivers.

describe("a run that may fall in a gameweek's lock (#1488)", () => {
  // GW11 began Saturday and is over; GW12's deadline is Tuesday, GW13's the Saturday after.
  const [SAT, TUE, WED, NEXT_SAT] = [0, 3, 4, 7].map((day) => day * DAY_MS);
  const deadlines = new Map([
    [11, SAT],
    [12, TUE],
    [13, NEXT_SAT],
  ]);

  test("one after the next deadline may be skipped by that gameweek", () => {
    expect(mayFallInLock(deadlines, null, TUE - HOUR_MS, WED)).toBe(12);
  });

  test("one before it falls in a gameweek that is over, so is made", () => {
    expect(mayFallInLock(deadlines, null, SAT + DAY_MS, TUE - HOUR_MS)).toBeNull();
  });

  test("in the lock, one may be skipped by the gameweek under way, and none is once its last match is over", () => {
    expect(mayFallInLock(deadlines, 12, WED - HOUR_MS, WED)).toBe(12);
    expect(mayFallInLock(deadlines, null, WED - HOUR_MS, WED)).toBeNull();
  });

  test("before any deadline none is", () => {
    expect(mayFallInLock(deadlines, null, SAT - DAY_MS, SAT - HOUR_MS)).toBeNull();
  });
});

describe("the run that can first take a player on waivers (#1467)", () => {
  // Winter, so UK time is UTC: GW12's deadline is Tuesday 12 January 2027 at 18:30, between GW11's
  // on the Saturday before and GW13's on the Saturday after; the runs are Wednesday and Thursday at 18:00.
  const runs = [
    { day: "wednesday", hour: 18, minute: 0 },
    { day: "thursday", hour: 18, minute: 0 },
  ] as const;
  const at = (day: number, hour: number, minute = 0) => Date.UTC(2027, 0, day, hour, minute);
  const deadlines = new Map([
    [11, at(9, 11)],
    [12, at(12, 18, 30)],
    [13, at(16, 11)],
  ]);
  const [WED_RUN, THU_RUN] = [at(13, 18), at(14, 18)];

  test("before the next deadline, the run after it may be skipped by that gameweek", () => {
    expect(firstRunTaking([...runs], deadlines, null, at(12, 12), at(11, 9))).toEqual({ at: WED_RUN, skippedIf: 12 });
    expect(firstRunTaking([...runs], deadlines, null, WED_RUN + 1, at(11, 9))).toEqual({ at: THU_RUN, skippedIf: 12 });
  });

  test("never names a run already gone: in the lock past Wednesday's, Thursday's, which may be skipped too", () => {
    expect(firstRunTaking([...runs], deadlines, 12, at(12, 12), at(13, 19))).toEqual({ at: THU_RUN, skippedIf: 12 });
  });

  test("once the gameweek's last match is over, the run is made", () => {
    expect(firstRunTaking([...runs], deadlines, null, at(12, 12), at(13, 22))).toEqual({ at: THU_RUN, skippedIf: null });
  });

  test("none with no run times", () => {
    expect(firstRunTaking([], deadlines, null, at(12, 12), at(11, 9))).toBeNull();
  });
});
