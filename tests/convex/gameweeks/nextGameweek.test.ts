import { describe, expect, test } from "vitest";
import type { DeadlineRule } from "../../../convex/gameweeks/deadline";
import { nextByDeadlines, nextGameweek } from "../../../convex/gameweeks/nextGameweek";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";

// Which gameweek a rule change takes effect from (#25 story 3: "a rule change applies from the next
// gameweek"). A change landing in a gameweek already locked would rescore lineups set under the old.

const SATURDAY_3PM = Date.parse("2026-10-24T14:00:00Z");
const NEXT_SATURDAY_3PM = SATURDAY_3PM + 7 * DAY_MS;

const gameweeks = [{ number: 9 }, { number: 10 }];
const matches = [
  { gameweek: 9, kickoff: SATURDAY_3PM },
  { gameweek: 9, kickoff: SATURDAY_3PM + 26 * HOUR_MS },
  { gameweek: 10, kickoff: NEXT_SATURDAY_3PM },
];
/** No deadline recorded as passed yet. */
const NOTHING_PASSED: ReadonlyMap<number, number> = new Map();
const minutesBefore = (minutesBeforeFirstKickoff: number) => (): DeadlineRule => ({ minutesBeforeFirstKickoff });
/** FPL's 90 minutes, the first rules' default: as a league's own rule, not FPL's deadline. */
const NINETY = 90;
const ninetyMinutes = minutesBefore(NINETY);
const ninetyBefore = (kickoff: number) => kickoff - NINETY * MINUTE_MS;

// A gameweek begins at the league's own deadline, never FPL's (Craig, 22 Oct 2026: "ours, we arent
// fpl so stop copying them"; #138). nextGameweek isn't given FPL's deadline at all.
describe("at the league's own deadline", () => {
  test("a change before gameweek 9's deadline applies from gameweek 9", () => {
    expect(nextGameweek(gameweeks, matches, ninetyMinutes, NOTHING_PASSED, ninetyBefore(SATURDAY_3PM) - 1)).toBe(9);
  });

  test("a change at gameweek 9's deadline waits for gameweek 10", () => {
    expect(nextGameweek(gameweeks, matches, ninetyMinutes, NOTHING_PASSED, ninetyBefore(SATURDAY_3PM))).toBe(10);
  });

  test("a change between gameweek 9's matches waits for gameweek 10", () => {
    expect(nextGameweek(gameweeks, matches, ninetyMinutes, NOTHING_PASSED, SATURDAY_3PM + 2 * HOUR_MS)).toBe(10);
  });
});

test("a league deadline earlier than FPL's 90 minutes locks the gameweek earlier", () => {
  const threeHours = minutesBefore(180);
  expect(nextGameweek(gameweeks, matches, threeHours, NOTHING_PASSED, SATURDAY_3PM - 3 * HOUR_MS - 1)).toBe(9);
  expect(nextGameweek(gameweeks, matches, threeHours, NOTHING_PASSED, SATURDAY_3PM - 3 * HOUR_MS)).toBe(10);
});

test("a league deadline later than FPL's 90 minutes locks the gameweek later, not at FPL's", () => {
  const atKickoff = minutesBefore(0);
  expect(nextGameweek(gameweeks, matches, atKickoff, NOTHING_PASSED, ninetyBefore(SATURDAY_3PM))).toBe(9);
  expect(nextGameweek(gameweeks, matches, atKickoff, NOTHING_PASSED, SATURDAY_3PM - 1)).toBe(9);
  expect(nextGameweek(gameweeks, matches, atKickoff, NOTHING_PASSED, SATURDAY_3PM)).toBe(10);
});

test("each gameweek is judged by the deadline rule in force in it", () => {
  const threeHoursFrom10 = (gameweek: number) => ({ minutesBeforeFirstKickoff: gameweek >= 10 ? 180 : NINETY });
  expect(nextGameweek(gameweeks, matches, threeHoursFrom10, NOTHING_PASSED, NEXT_SATURDAY_3PM - 2 * HOUR_MS)).toBe(11);
});

describe("a postponed first match (spec/05: once passed, a deadline stays where it fell; #150)", () => {
  const postponed = [{ gameweek: null, kickoff: null }, ...matches.slice(1)];
  const nineRecorded = new Map([[9, ninetyBefore(SATURDAY_3PM)]]);

  test("after gameweek 9's deadline was recorded, gameweek 9 stays begun", () => {
    expect(nextGameweek(gameweeks, postponed, ninetyMinutes, nineRecorded, SATURDAY_3PM + HOUR_MS)).toBe(10);
  });

  test("before the deadline, it moves the deadline to the next match's", () => {
    expect(nextGameweek(gameweeks, postponed, ninetyMinutes, NOTHING_PASSED, ninetyBefore(SATURDAY_3PM))).toBe(9);
    expect(nextGameweek(gameweeks, postponed, ninetyMinutes, NOTHING_PASSED, ninetyBefore(SATURDAY_3PM + 26 * HOUR_MS))).toBe(10);
  });
});

test("gameweeks are taken in order, whatever order they are held in", () => {
  expect(nextGameweek(gameweeks.toReversed(), matches, ninetyMinutes, NOTHING_PASSED, 0)).toBe(9);
});

test("with no gameweeks held yet, a change applies from gameweek 1", () => {
  expect(nextGameweek([], [], ninetyMinutes, NOTHING_PASSED, SATURDAY_3PM)).toBe(1);
});

test("once every gameweek has begun, a change applies from the one after the last", () => {
  expect(nextGameweek(gameweeks, matches, ninetyMinutes, NOTHING_PASSED, NEXT_SATURDAY_3PM)).toBe(11);
});

// A whole gameweek postponed (as FPL's was in September 2022) has no deadline, so never begins.
describe("a gameweek with no kickoff time behind one that has begun (#413)", () => {
  const withEight = [{ number: 8 }, ...gameweeks];
  const eightsMatchPostponed = [{ gameweek: null, kickoff: null }, ...matches];

  test("is passed over: the next is the first not begun after gameweek 9", () => {
    expect(nextGameweek(withEight, eightsMatchPostponed, ninetyMinutes, NOTHING_PASSED, SATURDAY_3PM + HOUR_MS)).toBe(10);
  });

  test("before any gameweek has begun, the first not begun is still the next", () => {
    expect(nextGameweek(withEight, eightsMatchPostponed, ninetyMinutes, NOTHING_PASSED, ninetyBefore(SATURDAY_3PM) - 1)).toBe(8);
  });

  test("once every gameweek after it has begun, the next is the one after the last", () => {
    expect(nextGameweek(withEight, eightsMatchPostponed, ninetyMinutes, NOTHING_PASSED, NEXT_SATURDAY_3PM)).toBe(11);
  });
});

// The rule the screens share with the server, by each gameweek's deadline and their own clock.
describe("the next by deadlines", () => {
  const NOW = SATURDAY_3PM;
  const begun = NOW - HOUR_MS;
  const notBegun = NOW + HOUR_MS;
  const held = (deadlines: readonly [number, number | null][]) => deadlines.map(([gameweek, deadline]) => ({ gameweek, deadline }));
  const nextOf = (inOrder: ReturnType<typeof held>) => nextByDeadlines(inOrder, (each) => each.deadline, NOW)?.gameweek;

  test("passes over one with no kickoff time behind one begun", () => {
    expect(nextOf(held([[30, null], [31, begun], [32, notBegun]]))).toBe(32);
  });

  test("is the first when none has begun", () => {
    expect(nextOf(held([[30, null], [31, notBegun], [32, notBegun]]))).toBe(30);
  });

  test("is none once every one has begun", () => {
    expect(nextOf(held([[30, begun], [31, begun]]))).toBeUndefined();
  });
});
