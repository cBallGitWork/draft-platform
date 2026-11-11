import { describe, expect, test } from "vitest";
import { winnersNow, withWinnersLast, wonBy } from "../../../convex/waivers/waiverOrder";
import { DAY_MS, HOUR_MS } from "../../../convex/shared/time";
import { firstRunTaking, mayFallInLock } from "../../../convex/waivers/waiverLock";
import { breaksLimits } from "../../../convex/waivers/waiverRun";

// The waiver order's rules (#1198, spec/08) and a claim against the squad's limits, pure.

describe("the waiver order", () => {
  test("each winner goes to the bottom, the latest last", () => {
    const winners = wonBy(wonBy(wonBy([], "A"), "C"), "A");
    expect(winners).toEqual(["C", "A"]);
    expect(withWinnersLast(["A", "B", "C", "D"], winners)).toEqual(["B", "D", "C", "A"]);
  });

  test("a winner no longer in the league is passed over", () => {
    expect(withWinnersLast(["A", "B"], ["Gone", "A"])).toEqual(["B", "A"]);
  });

  test("under reverse table order the winners go back up once a later gameweek has ended", () => {
    const held = { winners: ["A"], gameweek: 5 };
    expect(winnersNow("reverseStandings", held, 5)).toEqual(["A"]);
    expect(winnersNow("reverseStandings", held, 6)).toEqual([]);
  });

  test("under rotating they never do", () => {
    expect(winnersNow("rotating", { winners: ["A"], gameweek: 5 }, 9)).toEqual(["A"]);
  });

  test("before any run there are none", () => {
    expect(winnersNow("rotating", null, 5)).toEqual([]);
  });
});

describe("a claim against the squad's limits", () => {
  const over = (players: number) => ({ kind: "overMaximum" as const, players, maximum: 15 });
  const club = (players: number) => ({ kind: "overClubMaximum" as const, clubShortName: "ARS", players, maximum: 3 });
  const area = (players: number) => ({ kind: "underAreaMinimum" as const, area: "goalkeeper" as const, players, minimum: 2 });
  const under = (players: number) => ({ kind: "underMinimum" as const, players, minimum: 13 });

  test("breaks them by a limit newly broken", () => {
    expect(breaksLimits([], [over(16)])).toBe(true);
    expect(breaksLimits([], [club(4)])).toBe(true);
    expect(breaksLimits([], [area(1)])).toBe(true);
  });

  test("breaks them by going further past one already broken", () => {
    expect(breaksLimits([over(16)], [over(17)])).toBe(true);
    expect(breaksLimits([club(4)], [club(5)])).toBe(true);
    expect(breaksLimits([area(1)], [area(0)])).toBe(true);
  });

  test("doesn't by leaving one already broken as it was, or better", () => {
    expect(breaksLimits([over(16)], [over(16)])).toBe(false);
    expect(breaksLimits([area(0)], [area(1)])).toBe(false);
    expect(breaksLimits([club(4)], [])).toBe(false);
  });

  test("a squad under its minimum size is never the claim's doing", () => {
    expect(breaksLimits([under(11)], [under(12)])).toBe(false);
  });
});

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
