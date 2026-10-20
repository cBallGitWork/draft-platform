import { expect, test } from "vitest";
import { mapFpl } from "./fpl";
import { recordedFpl } from "./recorded/fpl.payloads";

const { bootstrap, fixtures } = recordedFpl();
const football = mapFpl(bootstrap, fixtures);

const HAALAND = 223094;
const RAYA = 154561;
const CLUB = { arsenal: 3, coventry: 9, manCity: 43 } as const;

test("every recorded club, player, match and gameweek is mapped", () => {
  expect(football.clubs).toHaveLength(20);
  expect(football.players).toHaveLength(7);
  expect(football.fixtures).toHaveLength(3);
  expect(football.gameweeks.map((gameweek) => gameweek.number)).toEqual([1, 7, 8]);
});

test("a player is his season-stable code, his names and his club's code, with no per-season id", () => {
  // In this payload his per-season id is 411 and Manchester City's is 15: neither is carried.
  expect(football.players.find((player) => player.code === HAALAND)).toEqual({
    code: HAALAND,
    name: "Haaland",
    fullName: "Erling Haaland",
    clubCode: CLUB.manCity,
  });
});

test("a full name joins FPL's first and second names, which can be several words", () => {
  expect(football.players.find((player) => player.code === RAYA)?.fullName).toBe("David Raya Martín");
});

test("a club is its code, its name and its three letters", () => {
  expect(football.clubs.find((club) => club.code === CLUB.arsenal)).toEqual({
    code: CLUB.arsenal,
    name: "Arsenal",
    shortName: "ARS",
  });
});

test("a match names both clubs by code and its kickoff in epoch milliseconds", () => {
  expect(football.fixtures.find((fixture) => fixture.code === 2645195)).toEqual({
    code: 2645195,
    gameweek: 1,
    homeClubCode: CLUB.arsenal,
    awayClubCode: CLUB.coventry,
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
