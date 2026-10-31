import { describe, expect, test } from "vitest";
import {
  FPL_DEADLINE_RULE,
  isLocked,
  leagueDeadline,
  type DeadlineRule,
} from "../../../convex/gameweeks/deadline";
import { mapFpl } from "../../../convex/football/fpl/fpl";
import { recordedSeason } from "../../support/recorded/fpl.payloads";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import { GAMEWEEKS } from "../../../convex/gameweeks/usedGameweeks";

const { bootstrap, fixtures } = recordedSeason();
const season = mapFpl(bootstrap, fixtures);

/** A gameweek whose deadline hasn't passed: none is recorded for it yet (#150). */
const NOTHING_RECORDED = null;

function minutesBefore(minutesBeforeFirstKickoff: number): DeadlineRule {
  return { minutesBeforeFirstKickoff };
}

/** FPL's own deadline for a gameweek, as recorded. */
function fplDeadline(gameweekNumber: number): number {
  const gameweek = season.gameweeks.find((recorded) => recorded.number === gameweekNumber);
  if (!gameweek) throw new Error(`The recording has no gameweek ${gameweekNumber}`);
  return gameweek.deadline;
}

describe("from the recorded 2026/27 season", () => {
  /** Every gameweek's deadline under `rule`, in the shape the football layer holds FPL's. */
  const deadlinesUnder = (rule: DeadlineRule) =>
    season.gameweeks.map(({ number }) => ({
      number,
      deadline: leagueDeadline(number, season.fixtures, rule, NOTHING_RECORDED),
    }));

  test("FPL's rule gives FPL's own deadline for every gameweek", () => {
    expect(season.gameweeks).toHaveLength(GAMEWEEKS);

    expect(deadlinesUnder(FPL_DEADLINE_RULE)).toEqual(season.gameweeks);
  });

  test("a league with its own rule gets its own deadline for every gameweek, not FPL's", () => {
    const LEAGUE_MINUTES = 60;
    const later = (FPL_DEADLINE_RULE.minutesBeforeFirstKickoff - LEAGUE_MINUTES) * MINUTE_MS;
    const laterThanFpl = season.gameweeks.map(({ number, deadline }) => ({ number, deadline: deadline + later }));

    expect(deadlinesUnder(minutesBefore(LEAGUE_MINUTES))).toEqual(laterThanFpl);
  });

  test("a double gameweek keeps one deadline, before the first of all its matches", () => {
    // A match from the gameweek after, rearranged into this one's midweek: both its clubs now play twice.
    const DOUBLE_GAMEWEEK = 8;
    const rearranged = season.fixtures.find((fixture) => fixture.gameweek === DOUBLE_GAMEWEEK + 1)!;
    const midweek = fplDeadline(DOUBLE_GAMEWEEK) + 4 * DAY_MS;
    const doubled = season.fixtures.map((fixture) =>
      fixture === rearranged ? { ...fixture, gameweek: DOUBLE_GAMEWEEK, kickoff: midweek } : fixture,
    );
    const plays = (clubCode: number, fixture: (typeof doubled)[number]) =>
      fixture.homeClubCode === clubCode || fixture.awayClubCode === clubCode;
    const matchCount = (clubCode: number) =>
      doubled.filter((fixture) => fixture.gameweek === DOUBLE_GAMEWEEK && plays(clubCode, fixture)).length;
    expect([rearranged.homeClubCode, rearranged.awayClubCode].map(matchCount)).toEqual([2, 2]);

    expect(leagueDeadline(DOUBLE_GAMEWEEK, doubled, FPL_DEADLINE_RULE, NOTHING_RECORDED)).toBe(
      fplDeadline(DOUBLE_GAMEWEEK),
    );
  });
});

describe("from a gameweek's matches", () => {
  // Not FPL's 90, so a result that comes out right only for FPL's rule fails here.
  const RULE_MINUTES = 75;
  const rule = minutesBefore(RULE_MINUTES);
  const deadlineBefore = (kickoff: number) => kickoff - RULE_MINUTES * MINUTE_MS;

  const FRIDAY_8PM = Date.UTC(2026, 9, 23, 19, 0);
  const SATURDAY_3PM = Date.UTC(2026, 9, 24, 14, 0);
  const SUNDAY_1PM = Date.UTC(2026, 9, 25, 13, 0);
  const GAMEWEEK = 8;
  const NEXT_GAMEWEEK = 9;
  const match = (gameweek: number | null, kickoff: number | null) => ({ gameweek, kickoff });
  const weekend = [match(GAMEWEEK, SATURDAY_3PM), match(GAMEWEEK, FRIDAY_8PM), match(GAMEWEEK, SUNDAY_1PM)];

  test("the deadline is the rule's minutes before the earliest kickoff, in any order", () => {
    expect(leagueDeadline(GAMEWEEK, weekend, rule, NOTHING_RECORDED)).toBe(deadlineBefore(FRIDAY_8PM));
  });

  test("a rule of 0 minutes puts the deadline at the first kickoff", () => {
    expect(leagueDeadline(GAMEWEEK, weekend, minutesBefore(0), NOTHING_RECORDED)).toBe(FRIDAY_8PM);
  });

  test("matches in other gameweeks do not move it", () => {
    const withNextGameweek = [...weekend, match(NEXT_GAMEWEEK, FRIDAY_8PM - DAY_MS)];

    expect(leagueDeadline(GAMEWEEK, withNextGameweek, rule, NOTHING_RECORDED)).toBe(deadlineBefore(FRIDAY_8PM));
  });

  test("a gameweek none of whose matches has a kickoff yet has no deadline", () => {
    const unscheduled = [match(GAMEWEEK, null), match(GAMEWEEK, null)];

    expect(leagueDeadline(GAMEWEEK, unscheduled, rule, NOTHING_RECORDED)).toBeNull();
  });

  test("a gameweek with no matches at all has no deadline", () => {
    expect(leagueDeadline(NEXT_GAMEWEEK, weekend, rule, NOTHING_RECORDED)).toBeNull();
  });

  test("a match with no kickoff yet is passed over for those that have one", () => {
    const withUnscheduled = [match(GAMEWEEK, null), ...weekend];

    expect(leagueDeadline(GAMEWEEK, withUnscheduled, rule, NOTHING_RECORDED)).toBe(deadlineBefore(FRIDAY_8PM));
  });

  test("the league's own deadline, the one every caller reads (#138), is the rule's with nothing recorded", () => {
    for (const minutes of [180, 90, 0]) {
      expect(leagueDeadline(GAMEWEEK, weekend, minutesBefore(minutes), null)).toBe(FRIDAY_8PM - minutes * MINUTE_MS);
    }
    expect(leagueDeadline(NEXT_GAMEWEEK, weekend, rule, null)).toBeNull();
  });

  test("once the league's deadline is recorded (#150), it is the deadline whatever the matches say", () => {
    const recorded = deadlineBefore(FRIDAY_8PM);
    const fridayPostponed = [match(null, null), match(GAMEWEEK, SATURDAY_3PM), match(GAMEWEEK, SUNDAY_1PM)];

    expect(leagueDeadline(GAMEWEEK, fridayPostponed, rule, recorded)).toBe(recorded);
    expect(leagueDeadline(GAMEWEEK, [], rule, recorded)).toBe(recorded);
  });

  describe("against the deadline recorded for it once passed", () => {
    const FRIDAY_DEADLINE = deadlineBefore(FRIDAY_8PM);
    const SATURDAY_DEADLINE = deadlineBefore(SATURDAY_3PM);

    const postponed = match(null, null);
    const [saturday, , sunday] = weekend;
    const firstMatchGone = [
      {
        change: "moved to the next gameweek",
        matches: [saturday, match(NEXT_GAMEWEEK, FRIDAY_8PM + 7 * DAY_MS), sunday],
        nextDeadline: SATURDAY_DEADLINE,
      },
      { change: "postponed", matches: [saturday, postponed, sunday], nextDeadline: SATURDAY_DEADLINE },
      { change: "postponed with every other match", matches: [postponed, postponed, postponed], nextDeadline: null },
    ];

    test.each(firstMatchGone)(
      "the first match $change before the deadline, nothing yet recorded, recomputes it from the matches left, unlocked at the old time",
      ({ matches, nextDeadline }) => {
        const deadline = leagueDeadline(GAMEWEEK, matches, rule, NOTHING_RECORDED);

        expect(deadline).toBe(nextDeadline);
        expect(isLocked(deadline, FRIDAY_DEADLINE)).toBe(false);
      },
    );

    test.each(
      firstMatchGone.flatMap((gone) => [
        { ...gone, when: "at", now: FRIDAY_DEADLINE },
        { ...gone, when: "an hour after", now: FRIDAY_DEADLINE + HOUR_MS },
      ]),
    )("the first match $change $when the recorded deadline leaves it where it fell, still locked", ({ matches, now }) => {
      const deadline = leagueDeadline(GAMEWEEK, matches, rule, FRIDAY_DEADLINE);

      expect(deadline).toBe(FRIDAY_DEADLINE);
      expect(isLocked(deadline, now)).toBe(true);
    });

    const THURSDAY_8PM = FRIDAY_8PM - DAY_MS;
    const THURSDAY_DEADLINE = deadlineBefore(THURSDAY_8PM);
    const movedIn = [...weekend, match(GAMEWEEK, THURSDAY_8PM)];

    test("a match rescheduled in ahead of the deadline, nothing yet recorded, brings it forward", () => {
      expect(leagueDeadline(GAMEWEEK, movedIn, rule, NOTHING_RECORDED)).toBe(THURSDAY_DEADLINE);
    });

    test("a match rescheduled in ahead of the deadline, read after its own before it is recorded, locks the gameweek", () => {
      const now = THURSDAY_DEADLINE + HOUR_MS;
      const deadline = leagueDeadline(GAMEWEEK, movedIn, rule, NOTHING_RECORDED);

      expect(deadline).toBe(THURSDAY_DEADLINE);
      expect(isLocked(deadline, now)).toBe(true);
    });

    test("a match rescheduled in ahead of a deadline already recorded leaves it where it fell", () => {
      expect(leagueDeadline(GAMEWEEK, movedIn, rule, FRIDAY_DEADLINE)).toBe(FRIDAY_DEADLINE);
    });
  });

  test.each([-1, 1.5, Number.NaN])("a rule of %s minutes is refused with the reason", (minutes) => {
    expect(() => leagueDeadline(GAMEWEEK, weekend, minutesBefore(minutes), NOTHING_RECORDED)).toThrow(
      `A deadline is a whole number of minutes, 0 or more, before the first kickoff, not ${minutes}`,
    );
  });
});

describe("the lock", () => {
  const DEADLINE = Date.UTC(2026, 9, 23, 17, 30);

  test("a change before the deadline is allowed", () => {
    expect(isLocked(DEADLINE, DEADLINE - 1)).toBe(false);
  });

  test("a change at the deadline is refused", () => {
    expect(isLocked(DEADLINE, DEADLINE)).toBe(true);
  });

  test("a change after the deadline is refused", () => {
    expect(isLocked(DEADLINE, DEADLINE + HOUR_MS)).toBe(true);
  });

  test("a gameweek with no deadline yet is not locked", () => {
    expect(isLocked(null, DEADLINE)).toBe(false);
  });
});
