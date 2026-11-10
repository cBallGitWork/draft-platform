// Sportmonks' payloads as ours (#1391): the season read as the Football seam's records, a live
// match's lineups, stats and events, and every catalogue stat's Sportmonks decision.

import { expect, test } from "vitest";
import { mapSportmonks } from "../../../../convex/football/sportmonks/sportmonks";
import { mapSportmonksMatch, smScoreRead } from "../../../../convex/football/sportmonks/sportmonksMatch";
import { MISSING, NOT_IN_SPORTMONKS, SPORTMONKS_STAT_IDS, SPORTMONKS_STAT_TYPES } from "../../../../convex/football/sportmonks/sportmonksStats";
import { STAT_CATALOGUE } from "../../../../convex/scoring/statCatalogueList";
import { SM, sportmonksLiveRead, sportmonksSeason } from "../../../support/recorded/sportmonks.payloads";

const celticKilmarnock = () => sportmonksLiveRead().data[0];

test("the season maps to the seam: clubs, each squad's men by Sportmonks' id, rounds as gameweeks and matches under them", () => {
  const football = mapSportmonks(sportmonksSeason());

  expect(football.clubs).toEqual([
    { code: SM.kilmarnock, name: "Kilmarnock", shortName: "KIL" },
    { code: SM.celtic, name: "Celtic", shortName: "CEL" },
    { code: SM.stMirren, name: "St. Mirren", shortName: "STM" },
  ]);
  expect(football.players).toEqual([
    { code: SM.owen, name: "Ieuan Owen", fullName: "Ieuan Gwyn Owen", clubCode: SM.kilmarnock },
    { code: SM.trusty, name: "Auston Trusty", fullName: "Auston Trusty", clubCode: SM.celtic },
    { code: SM.donovan, name: "Colby Donovan", fullName: "Colby Donovan", clubCode: SM.celtic },
    // Sportmonks spells his display name and full name differently: the display name shows.
    { code: SM.ramsey, name: "Calvin Ramsay", fullName: "Calvin Ramsey", clubCode: SM.stMirren },
  ]);
  expect(football.gameweeks).toEqual([
    { season: 2026, number: 13, deadline: Date.parse("2026-11-08T16:00:00Z") },
    { season: 2026, number: 14, deadline: Date.parse("2026-11-21T15:00:00Z") },
    { season: 2026, number: 15, deadline: Date.parse("2026-11-28T15:00:00Z") },
  ]);
  expect(football.fixtures).toEqual([
    { code: SM.celticKilmarnock, gameweek: 13, homeClubCode: SM.celtic, awayClubCode: SM.kilmarnock, kickoff: Date.parse("2026-11-08T16:00:00Z") },
    { code: SM.celticStMirren, gameweek: 14, homeClubCode: SM.celtic, awayClubCode: SM.stMirren, kickoff: Date.parse("2026-11-21T15:00:00Z") },
    { code: SM.stMirrenKilmarnock, gameweek: 15, homeClubCode: SM.stMirren, awayClubCode: SM.kilmarnock, kickoff: Date.parse("2026-11-28T15:00:00Z") },
  ]);
  expect(football.betweenSeasons).toBe(false);
  expect(football.scores).toEqual({
    reads: [
      { fixtureCode: SM.celticKilmarnock, state: "fullTime", homeGoals: 1, awayGoals: 0, minutes: null, clockLabel: null },
      { fixtureCode: SM.celticStMirren, state: "upcoming", homeGoals: null, awayGoals: null, minutes: null, clockLabel: null },
      { fixtureCode: SM.stMirrenKilmarnock, state: "upcoming", homeGoals: null, awayGoals: null, minutes: null, clockLabel: null },
    ],
    problems: [],
  });
});

test("where Sportmonks leaves out a club's short code, a man's display name or a match's timestamp, a stand-in is used", () => {
  // The real read sends all three; the docs allow each to be null.
  const payloads = sportmonksSeason();
  payloads.teams[2].short_code = null;
  payloads.teams[0].players![0].player!.display_name = null;
  payloads.schedule[0].rounds![0].fixtures![0].starting_at_timestamp = null;
  const football = mapSportmonks(payloads);

  // The name's first three letters, the common name and the UTC `starting_at`.
  expect(football.clubs[2]).toEqual({ code: SM.stMirren, name: "St. Mirren", shortName: "ST." });
  expect(football.players[0]).toMatchObject({ code: SM.owen, name: "I. Owen" });
  expect(football.fixtures[0]).toMatchObject({ code: SM.celticKilmarnock, kickoff: Date.parse("2026-11-08T16:00:00Z") });
});

test("rounds sharing a number across stages, as after the Scottish split, are one gameweek with the earliest kickoff", () => {
  // Round 15's match as a second round 14: in the same stage, then in a stage of its own.
  const asRound14 = (split: boolean) => {
    const payloads = sportmonksSeason();
    const [stage] = payloads.schedule;
    const round15 = stage.rounds!.find(({ name }) => name === "15")!;
    stage.rounds = stage.rounds!.filter((round) => round !== round15);
    const moved = { ...round15, name: "14" };
    if (split) payloads.schedule.push({ ...stage, rounds: [moved] });
    else stage.rounds.push(moved);
    return mapSportmonks(payloads);
  };
  const whole = asRound14(false);
  const split = asRound14(true);

  expect(split.gameweeks).toEqual(whole.gameweeks);
  expect(split.gameweeks.map(({ number, deadline }) => [number, deadline])).toEqual([
    [13, Date.parse("2026-11-08T16:00:00Z")],
    [14, Date.parse("2026-11-21T15:00:00Z")],
  ]);
  expect(split.fixtures).toEqual(whole.fixtures);
});

test("a season with no matches yet is between seasons", () => {
  const payloads = sportmonksSeason();
  payloads.schedule = [];
  expect(mapSportmonks(payloads)).toMatchObject({ fixtures: [], gameweeks: [], betweenSeasons: true });
});

test("a changed payload throws, naming what was missing, rather than map a guess", () => {
  const noSeason = sportmonksSeason();
  noSeason.league.currentseason = null;
  expect(() => mapSportmonks(noSeason)).toThrow("Sportmonks sent no current season");
  const noAway = sportmonksSeason();
  noAway.schedule[0].rounds![0].fixtures![0].participants = [{ id: SM.celtic, meta: { location: "home" } }];
  expect(() => mapSportmonks(noAway)).toThrow(`Sportmonks sent match ${SM.celticKilmarnock} with no home or away club`);
});

test("a state Sportmonks hasn't been mapped for, or a live match with no running score, is a problem for the run row, never a score", () => {
  const abandoned = { ...celticKilmarnock(), state_id: 15 };
  expect(() => smScoreRead(abandoned)).toThrow(`Sportmonks sent state 15 for match ${SM.celticKilmarnock}`);
  // In the second half (state 22).
  const noScore = { ...celticKilmarnock(), state_id: 22, scores: [] };
  expect(() => smScoreRead(noScore)).toThrow(`Sportmonks sent no home score for match ${SM.celticKilmarnock} at live`);
});

test("a live read maps to its score and clock, the lineups with each man's running totals, and the events by minute", () => {
  const { score, men, events } = mapSportmonksMatch(celticKilmarnock());

  // Read after full time: no period ticks, so no minute.
  expect(score).toEqual({ fixtureCode: SM.celticKilmarnock, state: "fullTime", homeGoals: 1, awayGoals: 0, minutes: null, clockLabel: null });
  expect(men).toHaveLength(40);
  expect(men.filter(({ started }) => started)).toHaveLength(22);
  expect(men.slice(0, 4).map(({ playerId, teamId, started, formationField, formationPosition }) => [playerId, teamId, started, formationField, formationPosition])).toEqual([
    [SM.sinisalo, SM.celtic, false, null, null],
    [SM.scales, SM.celtic, true, "2:3", 4],
    [SM.jota, SM.celtic, true, "4:3", 10],
    [SM.nygren, SM.celtic, true, "4:2", 9],
  ]);
  // An unused substitute carries no stats; the scorer his minutes (119), goal (52) and rating (118).
  expect(men[0].stats).toEqual([]);
  expect(men[1].stats).toEqual(expect.arrayContaining([{ typeId: 119, value: 90 }, { typeId: 52, value: 1 }, { typeId: 118, value: 8.15 }]));
  // Sportmonks sends the captaincy (40) as true: held as 1.
  const captain = men.find(({ playerId }) => playerId === SM.mcGregor)!;
  expect(captain.stats).toContainEqual({ typeId: 40, value: 1 });
  // Nineteen events by minute: yellow cards (19), substitutions (18), a disallowed goal and a
  // penalty awarded (10, VAR), the goal (14) and the penalty saved (17).
  expect(events.map(({ typeId, minute }) => [typeId, minute])).toEqual([
    [19, 9], [10, 15], [14, 26], [19, 33], [19, 40], [18, 46], [19, 50], [19, 61], [18, 64], [18, 64],
    [18, 70], [18, 71], [10, 73], [17, 76], [18, 82], [19, 82], [18, 86], [18, 86], [18, 89],
  ]);
  expect(events[2]).toEqual({
    id: 158609571,
    typeId: 14,
    minute: 26,
    extraMinute: null,
    teamId: SM.celtic,
    playerId: SM.scales,
    relatedPlayerId: 37709508,
    result: "1-0",
    info: "Left foot shot",
    addition: "1st Goal",
  });
});

test("a lineup type or a stat value not seen before throws, naming it, rather than be dropped", () => {
  const coach = celticKilmarnock();
  coach.lineups![0].type_id = 13;
  expect(() => mapSportmonksMatch(coach)).toThrow(`Sportmonks sent lineup type 13 for player ${SM.sinisalo} in match ${SM.celticKilmarnock}`);
  const shaped = celticKilmarnock();
  const [stat] = shaped.lineups![1].details!;
  stat.data = { value: { total: 90 } };
  expect(() => mapSportmonksMatch(shaped)).toThrow(`Sportmonks sent stat ${stat.type_id} for player ${SM.scales} in match ${SM.celticKilmarnock} as {"total":90}`);
});

test("the defensive, keeper and possession stats a Scottish starter carried (9 Nov 2026, #1391) are mapped, not marked missing", () => {
  // Type ids from the starters' `lineups.details` in three finished Scottish Premiership matches.
  const sent: Record<string, number> = {
    aerial_lost: 27266, backward_pass: 27272, ball_recovery: 27271, challenge_lost: 110, duel_lost: 1491,
    error_lead_to_shot: 48997, good_high_claim: 584, last_man_tackle: 583, poss_lost_all: 27273, punches: 103,
    recoveries: 27271, won_tackle: 27267,
  };
  for (const [stat, id] of Object.entries(sent)) expect(SPORTMONKS_STAT_TYPES[stat]).toBe(id);
});

test("every catalogue stat has its Sportmonks type id or is marked missing, in one table, and nothing else is in it", () => {
  const catalogue = STAT_CATALOGUE.map(({ stat }) => stat).sort();
  expect(Object.keys(SPORTMONKS_STAT_TYPES).sort()).toEqual(catalogue);
  // Decided once each: never both mapped and missing.
  expect(NOT_IN_SPORTMONKS.filter((stat) => stat in SPORTMONKS_STAT_IDS)).toEqual([]);
  expect(new Set(NOT_IN_SPORTMONKS).size).toBe(NOT_IN_SPORTMONKS.length);
  for (const decision of Object.values(SPORTMONKS_STAT_TYPES)) {
    expect(decision === MISSING || (Number.isInteger(decision) && decision > 0)).toBe(true);
  }
});
