import { describe, expect, test } from "vitest";
import { FPL_DEADLINE_RULE, type DeadlineRule } from "../../../convex/gameweeks/deadline";
import { nextGameweek } from "../../../convex/gameweeks/nextGameweek";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";

// Which gameweek a rule change takes effect from (#25 story 3: "a rule change applies from the next
// gameweek"). A change landing in a gameweek already locked would rescore lineups set under the old.

const SATURDAY_3PM = Date.parse("2026-10-24T14:00:00Z");
const NEXT_SATURDAY_3PM = SATURDAY_3PM + 7 * DAY_MS;

const fplDeadline = (firstKickoff: number) => firstKickoff - 90 * MINUTE_MS;
const gameweeks = [
  { number: 9, deadline: fplDeadline(SATURDAY_3PM) },
  { number: 10, deadline: fplDeadline(NEXT_SATURDAY_3PM) },
];
const matches = [
  { gameweek: 9, kickoff: SATURDAY_3PM },
  { gameweek: 9, kickoff: SATURDAY_3PM + 26 * HOUR_MS },
  { gameweek: 10, kickoff: NEXT_SATURDAY_3PM },
];
const fpls = () => FPL_DEADLINE_RULE;
const minutesBefore = (minutesBeforeFirstKickoff: number) => (): DeadlineRule => ({ minutesBeforeFirstKickoff });

describe("under FPL's deadline", () => {
  test("a change before gameweek 9's deadline applies from gameweek 9", () => {
    expect(nextGameweek(gameweeks, matches, fpls, fplDeadline(SATURDAY_3PM) - 1)).toBe(9);
  });

  test("a change at gameweek 9's deadline waits for gameweek 10", () => {
    expect(nextGameweek(gameweeks, matches, fpls, fplDeadline(SATURDAY_3PM))).toBe(10);
  });

  test("a change between gameweek 9's matches waits for gameweek 10", () => {
    expect(nextGameweek(gameweeks, matches, fpls, SATURDAY_3PM + 2 * HOUR_MS)).toBe(10);
  });
});

test("a league deadline earlier than FPL's locks the gameweek earlier", () => {
  const threeHours = minutesBefore(180);
  expect(nextGameweek(gameweeks, matches, threeHours, SATURDAY_3PM - 3 * HOUR_MS - 1)).toBe(9);
  expect(nextGameweek(gameweeks, matches, threeHours, SATURDAY_3PM - 2 * HOUR_MS)).toBe(10);
});

test("each gameweek is judged by the deadline rule in force in it", () => {
  const threeHoursFrom10 = (gameweek: number) => ({ minutesBeforeFirstKickoff: gameweek >= 10 ? 180 : 90 });
  expect(nextGameweek(gameweeks, matches, threeHoursFrom10, NEXT_SATURDAY_3PM - 2 * HOUR_MS)).toBe(11);
});

test("a league deadline later than FPL's still locks at FPL's, so a change never waits too little", () => {
  expect(nextGameweek(gameweeks, matches, minutesBefore(0), fplDeadline(SATURDAY_3PM))).toBe(10);
});

test("gameweek 9 stays begun when its first match is postponed after its deadline", () => {
  const postponed = [{ gameweek: null, kickoff: null }, ...matches.slice(1)];
  expect(nextGameweek(gameweeks, postponed, fpls, SATURDAY_3PM + HOUR_MS)).toBe(10);
});

test("gameweeks are taken in order, whatever order they are held in", () => {
  expect(nextGameweek(gameweeks.toReversed(), matches, fpls, 0)).toBe(9);
});

test("with no gameweeks held yet, a change applies from gameweek 1", () => {
  expect(nextGameweek([], [], fpls, SATURDAY_3PM)).toBe(1);
});

test("once every gameweek has begun, a change applies from the one after the last", () => {
  expect(nextGameweek(gameweeks, matches, fpls, NEXT_SATURDAY_3PM)).toBe(11);
});
