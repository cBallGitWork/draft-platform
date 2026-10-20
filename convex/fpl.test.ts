import { expect, test } from "vitest";
import { mapFpl } from "./fpl";
import { CLUB_CODE, RECORDED_COUNT, recordedFpl } from "./recorded/fpl.payloads";

const { bootstrap, fixtures } = recordedFpl();
const football = mapFpl(bootstrap, fixtures);

const HAALAND = 223094;
const RAYA = 154561;
const ARSENAL_V_COVENTRY = 2645195;

test("every recorded club, player, match and gameweek is mapped", () => {
  expect(football.clubs).toHaveLength(RECORDED_COUNT.clubs);
  expect(football.players).toHaveLength(RECORDED_COUNT.players);
  expect(football.fixtures).toHaveLength(RECORDED_COUNT.fixtures);
  expect(football.gameweeks.map((gameweek) => gameweek.number)).toEqual([1, 7, 8]);
});

test("a player is his season-stable code, his names and his club's code, with no per-season id", () => {
  // In this payload his per-season id is 411 and Manchester City's is 15: neither is carried.
  expect(football.players.find((player) => player.code === HAALAND)).toEqual({
    code: HAALAND,
    name: "Haaland",
    fullName: "Erling Haaland",
    clubCode: CLUB_CODE.manCity,
  });
});

test("a full name joins FPL's first and second names, which can be several words", () => {
  expect(football.players.find((player) => player.code === RAYA)?.fullName).toBe("David Raya Martín");
});

test("a club is its code, its name and its three letters", () => {
  expect(football.clubs.find((club) => club.code === CLUB_CODE.arsenal)).toEqual({
    code: CLUB_CODE.arsenal,
    name: "Arsenal",
    shortName: "ARS",
  });
});

test("a match names both clubs by code and its kickoff in epoch milliseconds", () => {
  expect(football.fixtures.find((fixture) => fixture.code === ARSENAL_V_COVENTRY)).toEqual({
    code: ARSENAL_V_COVENTRY,
    gameweek: 1,
    homeClubCode: CLUB_CODE.arsenal,
    awayClubCode: CLUB_CODE.coventry,
    kickoff: Date.UTC(2026, 7, 21, 19, 0),
  });
});

test("a gameweek is its number and FPL's own deadline", () => {
  expect(football.gameweeks[0]).toEqual({ number: 1, deadline: Date.UTC(2026, 7, 21, 17, 30) });
});

test("a postponed match with no gameweek or kickoff yet is held without them", () => {
  const postponed = { ...fixtures[2], event: null, kickoff_time: null };
  expect(mapFpl(bootstrap, [postponed]).fixtures[0]).toMatchObject({ gameweek: null, kickoff: null });
});

test("a match naming a club bootstrap-static does not list throws, naming the club", () => {
  const stranger = { ...fixtures[0], team_a: 99 };
  expect(() => mapFpl(bootstrap, [stranger])).toThrow("FPL names club id 99");
});

test("a deadline that does not parse throws rather than hold a gameweek with no time", () => {
  const garbled = { ...bootstrap, events: [{ ...bootstrap.events[0], deadline_time: "soon" }] };
  expect(() => mapFpl(garbled, fixtures)).toThrow('does not parse: "soon"');
});

test("a player FPL sends twice is a changed payload, and throws rather than be held twice", () => {
  const doubled = recordedFpl();
  doubled.bootstrap.elements.push({ ...doubled.bootstrap.elements[0] });

  expect(() => mapFpl(doubled.bootstrap, doubled.fixtures)).toThrow(
    `FPL sent player ${doubled.bootstrap.elements[0].code} twice`,
  );
});

test("a match FPL sends twice throws too", () => {
  const doubled = recordedFpl();
  doubled.fixtures.push({ ...doubled.fixtures[0] });

  expect(() => mapFpl(doubled.bootstrap, doubled.fixtures)).toThrow(`FPL sent match ${ARSENAL_V_COVENTRY} twice`);
});
