import { describe, expect, test } from "vitest";
import {
  FPL_DEADLINE_RULE,
  gameweekDeadline,
  isLocked,
  MS_PER_MINUTE,
  type DeadlineReading,
  type DeadlineRule,
} from "./deadline";
import { mapFpl } from "./fpl";
import { recordedSeason } from "./recorded/fpl.payloads";

const { bootstrap, fixtures } = recordedSeason();
const season = mapFpl(bootstrap, fixtures);
const SEASON_GAMEWEEKS = 38;

const HOUR = 60 * MS_PER_MINUTE;
const DAY = 24 * HOUR;

/** A gameweek seen for the first time: with nothing recorded, when it is read changes nothing. */
const NOTHING_RECORDED: DeadlineReading = { recorded: null, now: 0 };

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
    season.gameweeks.map(({ number }) => ({ number, deadline: gameweekDeadline(number, season.fixtures, rule, NOTHING_RECORDED) }));

  test("FPL's rule gives FPL's own deadline for every gameweek", () => {
    expect(season.gameweeks).toHaveLength(SEASON_GAMEWEEKS);

    expect(deadlinesUnder(FPL_DEADLINE_RULE)).toEqual(season.gameweeks);
  });

  test("a league with its own rule gets its own deadline for every gameweek, not FPL's", () => {
    const LEAGUE_MINUTES = 60;
    const later = (FPL_DEADLINE_RULE.minutesBeforeFirstKickoff - LEAGUE_MINUTES) * MS_PER_MINUTE;
    const laterThanFpl = season.gameweeks.map(({ number, deadline }) => ({ number, deadline: deadline + later }));

    expect(deadlinesUnder(minutesBefore(LEAGUE_MINUTES))).toEqual(laterThanFpl);
  });

  test("a double gameweek keeps one deadline, before the first of all its matches", () => {
    // A match from the gameweek after, rearranged into this one's midweek: both its clubs now play twice.
    const DOUBLE_GAMEWEEK = 8;
    const rearranged = season.fixtures.find((fixture) => fixture.gameweek === DOUBLE_GAMEWEEK + 1)!;
    const midweek = fplDeadline(DOUBLE_GAMEWEEK) + 4 * DAY;
    const doubled = season.fixtures.map((fixture) =>
      fixture === rearranged ? { ...fixture, gameweek: DOUBLE_GAMEWEEK, kickoff: midweek } : fixture,
    );
    const plays = (clubCode: number, fixture: (typeof doubled)[number]) =>
      fixture.homeClubCode === clubCode || fixture.awayClubCode === clubCode;
    const matchCount = (clubCode: number) =>
      doubled.filter((fixture) => fixture.gameweek === DOUBLE_GAMEWEEK && plays(clubCode, fixture)).length;
    expect([rearranged.homeClubCode, rearranged.awayClubCode].map(matchCount)).toEqual([2, 2]);

    expect(gameweekDeadline(DOUBLE_GAMEWEEK, doubled, FPL_DEADLINE_RULE, NOTHING_RECORDED)).toBe(fplDeadline(DOUBLE_GAMEWEEK));
  });
});

describe("from a gameweek's matches", () => {
  // Not FPL's 90, so a result that comes out right only for FPL's rule fails here.
  const RULE_MINUTES = 75;
  const rule = minutesBefore(RULE_MINUTES);
  const deadlineBefore = (kickoff: number) => kickoff - RULE_MINUTES * MS_PER_MINUTE;

  const FRIDAY_8PM = Date.UTC(2026, 9, 23, 19, 0);
  const SATURDAY_3PM = Date.UTC(2026, 9, 24, 14, 0);
  const SUNDAY_1PM = Date.UTC(2026, 9, 25, 13, 0);
  const GAMEWEEK = 8;
  const NEXT_GAMEWEEK = 9;
  const match = (gameweek: number | null, kickoff: number | null) => ({ gameweek, kickoff });
  const weekend = [match(GAMEWEEK, SATURDAY_3PM), match(GAMEWEEK, FRIDAY_8PM), match(GAMEWEEK, SUNDAY_1PM)];

  test("the deadline is the rule's minutes before the earliest kickoff, in any order", () => {
    expect(gameweekDeadline(GAMEWEEK, weekend, rule, NOTHING_RECORDED)).toBe(deadlineBefore(FRIDAY_8PM));
  });

  test("a rule of 0 minutes puts the deadline at the first kickoff", () => {
    expect(gameweekDeadline(GAMEWEEK, weekend, minutesBefore(0), NOTHING_RECORDED)).toBe(FRIDAY_8PM);
  });

  test("matches in other gameweeks do not move it", () => {
    const withNextGameweek = [...weekend, match(NEXT_GAMEWEEK, FRIDAY_8PM - DAY)];

    expect(gameweekDeadline(GAMEWEEK, withNextGameweek, rule, NOTHING_RECORDED)).toBe(deadlineBefore(FRIDAY_8PM));
  });

  test("a gameweek none of whose matches has a kickoff yet has no deadline", () => {
    expect(gameweekDeadline(GAMEWEEK, [match(GAMEWEEK, null), match(GAMEWEEK, null)], rule, NOTHING_RECORDED)).toBeNull();
  });

  test("a gameweek with no matches at all has no deadline", () => {
    expect(gameweekDeadline(NEXT_GAMEWEEK, weekend, rule, NOTHING_RECORDED)).toBeNull();
  });

  test("a match with no kickoff yet is passed over for those that have one", () => {
    expect(gameweekDeadline(GAMEWEEK, [match(GAMEWEEK, null), ...weekend], rule, NOTHING_RECORDED)).toBe(deadlineBefore(FRIDAY_8PM));
  });

  describe("against the deadline recorded for it", () => {
    const FRIDAY_DEADLINE = deadlineBefore(FRIDAY_8PM);
    const readAt = (now: number): DeadlineReading => ({ recorded: FRIDAY_DEADLINE, now });

    const [saturday, , sunday] = weekend;
    const firstMatchGone = {
      "moved to the next gameweek": [saturday, match(NEXT_GAMEWEEK, FRIDAY_8PM + 7 * DAY), sunday],
      postponed: [saturday, match(null, null), sunday],
      "postponed with every other match": [match(null, null), match(null, null), match(null, null)],
    };
    const nextKickoffDeadline = {
      "moved to the next gameweek": deadlineBefore(SATURDAY_3PM),
      postponed: deadlineBefore(SATURDAY_3PM),
      "postponed with every other match": null,
    };

    test.each(Object.keys(firstMatchGone) as (keyof typeof firstMatchGone)[])(
      "the first match %s before the deadline puts it back to the next kickoff",
      (change) => {
        const deadline = gameweekDeadline(GAMEWEEK, firstMatchGone[change], rule, readAt(FRIDAY_DEADLINE - 1));

        expect(deadline).toBe(nextKickoffDeadline[change]);
        expect(isLocked(deadline, FRIDAY_DEADLINE)).toBe(false);
      },
    );

    test.each(
      (Object.keys(firstMatchGone) as (keyof typeof firstMatchGone)[]).flatMap((change) => [
        { change, when: "at", now: FRIDAY_DEADLINE },
        { change, when: "an hour after", now: FRIDAY_DEADLINE + HOUR },
      ]),
    )("the first match $change $when the deadline leaves it where it fell, still locked", ({ change, now }) => {
      const deadline = gameweekDeadline(GAMEWEEK, firstMatchGone[change], rule, readAt(now));

      expect(deadline).toBe(FRIDAY_DEADLINE);
      expect(isLocked(deadline, now)).toBe(true);
    });

    const THURSDAY_8PM = FRIDAY_8PM - DAY;
    const movedIn = [...weekend, match(GAMEWEEK, THURSDAY_8PM)];

    test("a match rescheduled into the gameweek before the deadline brings it forward", () => {
      const now = deadlineBefore(THURSDAY_8PM) - 1;

      expect(gameweekDeadline(GAMEWEEK, movedIn, rule, readAt(now))).toBe(deadlineBefore(THURSDAY_8PM));
    });

    test("a match rescheduled into the gameweek before the deadline, and read after its own, locks it", () => {
      const now = deadlineBefore(THURSDAY_8PM) + HOUR;
      const deadline = gameweekDeadline(GAMEWEEK, movedIn, rule, readAt(now));

      expect(deadline).toBe(deadlineBefore(THURSDAY_8PM));
      expect(isLocked(deadline, now)).toBe(true);
    });
  });

  test.each([-1, 1.5, Number.NaN])("a rule of %s minutes is refused with the reason", (minutes) => {
    expect(() => gameweekDeadline(GAMEWEEK, weekend, minutesBefore(minutes), NOTHING_RECORDED)).toThrow(
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
    expect(isLocked(DEADLINE, DEADLINE + HOUR)).toBe(true);
  });

  test("a gameweek with no deadline yet is not locked", () => {
    expect(isLocked(null, DEADLINE)).toBe(false);
  });
});
