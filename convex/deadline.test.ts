import { describe, expect, test } from "vitest";
import { FPL_DEADLINE_RULE, gameweekDeadline, isLocked, type DeadlineRule } from "./deadline";
import { mapFpl } from "./fpl";
import { recordedSeason } from "./recorded/fpl.payloads";

const { bootstrap, fixtures } = recordedSeason();
const season = mapFpl(bootstrap, fixtures);
const SEASON_GAMEWEEKS = 38;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** FPL's own deadline for a gameweek, as recorded. */
function fplDeadline(number: number): number {
  const gameweek = season.gameweeks.find((recorded) => recorded.number === number);
  if (!gameweek) throw new Error(`The recording has no gameweek ${number}`);
  return gameweek.deadline;
}

function minutesBefore(minutesBeforeFirstKickoff: number): DeadlineRule {
  return { minutesBeforeFirstKickoff };
}

/** A match in `gameweek` kicking off at `kickoff`, as the deadline reads it. */
function match(gameweek: number | null, kickoff: number | null) {
  return { gameweek, kickoff };
}

describe("from the recorded 2026/27 season", () => {
  test("FPL's rule gives FPL's own deadline for every gameweek", () => {
    expect(season.gameweeks).toHaveLength(SEASON_GAMEWEEKS);
    const ours = season.gameweeks.map((gameweek) => ({
      number: gameweek.number,
      deadline: gameweekDeadline(gameweek.number, season.fixtures, FPL_DEADLINE_RULE),
    }));

    expect(ours).toEqual(season.gameweeks);
  });

  test("a league with its own rule gets its own deadline for every gameweek, not FPL's", () => {
    const thirtyMinutesLater = (gameweek: (typeof season.gameweeks)[number]) => gameweek.deadline + 30 * MINUTE;

    for (const gameweek of season.gameweeks) {
      expect(gameweekDeadline(gameweek.number, season.fixtures, minutesBefore(60))).toBe(thirtyMinutesLater(gameweek));
    }
  });

  test("a double gameweek has one deadline for every team, before the first of all its matches", () => {
    // A gameweek 9 match rearranged into gameweek 8's midweek: both its clubs now play twice.
    const rearranged = season.fixtures.find((fixture) => fixture.gameweek === 9)!;
    const doubleGameweek8 = season.fixtures.map((fixture) =>
      fixture === rearranged ? { ...fixture, gameweek: 8, kickoff: fplDeadline(8) + 4 * 24 * HOUR } : fixture,
    );
    const matchesOf = (clubCode: number) =>
      doubleGameweek8.filter((f) => f.gameweek === 8 && (f.homeClubCode === clubCode || f.awayClubCode === clubCode));
    expect(matchesOf(rearranged.homeClubCode)).toHaveLength(2);

    expect(gameweekDeadline(8, doubleGameweek8, FPL_DEADLINE_RULE)).toBe(fplDeadline(8));
  });
});

describe("from a gameweek's matches", () => {
  const FRIDAY_8PM = Date.UTC(2026, 9, 23, 19, 0);
  const SATURDAY_3PM = Date.UTC(2026, 9, 24, 14, 0);
  const SUNDAY_2PM = Date.UTC(2026, 9, 25, 13, 0);
  const gameweek8 = [match(8, SATURDAY_3PM), match(8, FRIDAY_8PM), match(8, SUNDAY_2PM)];

  test("the deadline is the rule's minutes before the earliest kickoff, in any order", () => {
    expect(gameweekDeadline(8, gameweek8, minutesBefore(90))).toBe(FRIDAY_8PM - 90 * MINUTE);
  });

  test("a rule of 0 minutes puts the deadline at the first kickoff", () => {
    expect(gameweekDeadline(8, gameweek8, minutesBefore(0))).toBe(FRIDAY_8PM);
  });

  test("matches in other gameweeks do not move it", () => {
    const withGameweek9 = [...gameweek8, match(9, FRIDAY_8PM - 24 * HOUR)];

    expect(gameweekDeadline(8, withGameweek9, minutesBefore(90))).toBe(FRIDAY_8PM - 90 * MINUTE);
  });

  test("a gameweek none of whose matches has a kickoff yet has no deadline", () => {
    expect(gameweekDeadline(8, [match(8, null), match(8, null)], minutesBefore(90))).toBeNull();
  });

  test("a gameweek with no matches at all has no deadline", () => {
    expect(gameweekDeadline(9, gameweek8, minutesBefore(90))).toBeNull();
  });

  test("a match with no kickoff yet is passed over for those that have one", () => {
    expect(gameweekDeadline(8, [match(8, null), ...gameweek8], minutesBefore(90))).toBe(FRIDAY_8PM - 90 * MINUTE);
  });

  test("a match rescheduled into the gameweek, before its first kickoff, brings the deadline forward", () => {
    const THURSDAY_8PM = FRIDAY_8PM - 24 * HOUR;
    const movedIn = [...gameweek8, match(8, THURSDAY_8PM)];

    expect(gameweekDeadline(8, movedIn, minutesBefore(90))).toBe(THURSDAY_8PM - 90 * MINUTE);
  });

  test("the first match rescheduled out of the gameweek puts the deadline back to the next kickoff", () => {
    const [saturday, , sunday] = gameweek8;
    const fridayMovedTo9 = [saturday, match(9, FRIDAY_8PM + 7 * 24 * HOUR), sunday];
    const fridayPostponed = [saturday, match(null, null), sunday];

    expect(gameweekDeadline(8, fridayMovedTo9, minutesBefore(90))).toBe(SATURDAY_3PM - 90 * MINUTE);
    expect(gameweekDeadline(8, fridayPostponed, minutesBefore(90))).toBe(SATURDAY_3PM - 90 * MINUTE);
  });

  test.each([-1, 1.5, Number.NaN])("a rule of %s minutes is refused with the reason", (minutes) => {
    expect(() => gameweekDeadline(8, gameweek8, minutesBefore(minutes))).toThrow(
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
