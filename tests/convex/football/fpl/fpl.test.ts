import { expect, test } from "vitest";
import { mapFpl } from "../../../../convex/football/fpl/fpl";
import { JULY, JUNE } from "../../../../convex/shared/time";
import { CLUB_CODE, FIXTURE_CODE, PLAYER_CODE, RECORDED_COUNT, recordedFpl, type FplPayloads } from "../../../support/recorded/fpl.payloads";

const { bootstrap, fixtures } = recordedFpl();
const football = mapFpl(bootstrap, fixtures);

const { haaland: HAALAND, raya: RAYA } = PLAYER_CODE;
const ARSENAL_V_COVENTRY = FIXTURE_CODE.arsenalVCoventry;

test("every recorded club, player, match and gameweek is mapped", () => {
  expect(football.clubs).toHaveLength(RECORDED_COUNT.clubs);
  expect(football.players).toHaveLength(RECORDED_COUNT.players);
  expect(football.fixtures).toHaveLength(RECORDED_COUNT.fixtures);
  expect(football.gameweeks.map((gameweek) => gameweek.number)).toEqual([1, 7, 8]);
});

test("a player is his season-stable code, his names, his club's code and FPL's news on him, with no per-season id", () => {
  // In this payload his per-season id is 411 and Manchester City's is 15: neither is carried.
  expect(football.players.find((player) => player.code === HAALAND)).toEqual({
    code: HAALAND,
    name: "Haaland",
    fullName: "Erling Haaland",
    clubCode: CLUB_CODE.manCity,
    news: "Unspecified injury - 75% chance of playing",
    chanceOfPlaying: 75,
    availability: "doubtful",
  });
});

test("a player FPL has no doubt about has no news and no chance of playing", () => {
  expect(football.players.find((player) => player.code === PLAYER_CODE.saka)).toMatchObject({ news: "", chanceOfPlaying: null });
});

test("a full name joins FPL's first and second names, which can be several words", () => {
  expect(football.players.find((player) => player.code === RAYA)?.fullName).toBe("David Raya Martín");
});

test("a player with only one of FPL's two names has no stray space in his full name", () => {
  const payloads = recordedFpl();
  const [first, second] = payloads.bootstrap.elements;
  first.first_name = "";
  second.second_name = "";

  const players = mapFpl(payloads.bootstrap, payloads.fixtures).players;

  expect(players.find((player) => player.code === first.code)?.fullName).toBe(first.second_name);
  expect(players.find((player) => player.code === second.code)?.fullName).toBe(second.first_name);
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

test("a gameweek is its season, its number and FPL's own deadline (#66)", () => {
  expect(football.gameweeks[0]).toEqual({ season: 2026, number: 1, deadline: Date.UTC(2026, 7, 21, 17, 30) });
});

test("a gameweek's season is the one its season's first deadline falls in, so next August's are 2027's (#66)", () => {
  const nextAugust = recordedFpl();
  nextAugust.bootstrap.events = nextAugust.bootstrap.events.map((event) => ({
    ...event,
    deadline_time: event.deadline_time.replace("2026-", "2027-"),
  }));
  expect(new Set(mapFpl(nextAugust.bootstrap, nextAugust.fixtures).gameweeks.map(({ season }) => season))).toEqual(new Set([2027]));
});

// Between seasons FPL can send no fixtures until it publishes the next season's (#66).
const FIRST_DEADLINE = Date.UTC(2026, 7, 21, 17, 30);
test.each([
  ["from 1 June after the season", Date.UTC(2027, JUNE, 1)],
  ["in July after it", Date.UTC(2027, JULY, 10)],
  ["before the season's first deadline", FIRST_DEADLINE - 1],
])("an empty fixtures list %s is between seasons: none sent, none refused", (_when, now) => {
  const mapped = mapFpl(bootstrap, [], now);
  expect(mapped.betweenSeasons).toBe(true);
  expect(mapped.fixtures).toEqual([]);
  expect(mapped.gameweeks).toHaveLength(football.gameweeks.length);
});

test.each([
  ["at the first deadline", FIRST_DEADLINE],
  ["on 31 May, the season not yet over", Date.UTC(2027, JUNE, 1) - 1],
])("an empty fixtures list %s is still refused", (_when, now) => {
  expect(() => mapFpl(bootstrap, [], now)).toThrow("FPL sent an empty match list");
});

test("a sent fixtures list is never between seasons, whatever the date", () => {
  expect(mapFpl(bootstrap, fixtures, Date.UTC(2027, JULY, 10)).betweenSeasons).toBe(false);
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

// A key sent twice is a changed payload: it throws rather than be held twice.
test.each([
  ["club", (fpl: FplPayloads) => fpl.bootstrap.teams.push({ ...fpl.bootstrap.teams[0] }), CLUB_CODE.arsenal],
  ["player", (fpl: FplPayloads) => fpl.bootstrap.elements.push({ ...fpl.bootstrap.elements[0] }), HAALAND],
  ["match", (fpl: FplPayloads) => fpl.fixtures.push({ ...fpl.fixtures[0] }), ARSENAL_V_COVENTRY],
  ["gameweek", (fpl: FplPayloads) => fpl.bootstrap.events.push({ ...fpl.bootstrap.events[0] }), 1],
] as const)("a %s FPL sends twice throws", (kind, sendTwice, key) => {
  const doubled = recordedFpl();
  sendTwice(doubled);

  expect(() => mapFpl(doubled.bootstrap, doubled.fixtures)).toThrow(`FPL sent ${kind} ${key} twice`);
});

// The sync marks every held row a list leaves out, so an empty list throws rather than mark them all.
test.each([
  ["club", (fpl: FplPayloads) => (fpl.bootstrap.teams = [])],
  ["player", (fpl: FplPayloads) => (fpl.bootstrap.elements = [])],
  ["match", (fpl: FplPayloads) => (fpl.fixtures = [])],
  ["gameweek", (fpl: FplPayloads) => (fpl.bootstrap.events = [])],
] as const)("an empty %s list throws", (kind, empty) => {
  const emptied = recordedFpl();
  empty(emptied);

  expect(() => mapFpl(emptied.bootstrap, emptied.fixtures)).toThrow(`FPL sent an empty ${kind} list`);
});
