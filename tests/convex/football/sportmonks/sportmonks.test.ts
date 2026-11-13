// Sportmonks' payloads as ours (#1391): the season read as the Football seam's records, a live
// match's lineups, stats and events, and every catalogue stat's Sportmonks decision.

import { expect, test } from "vitest";
import { mapSportmonks } from "../../../../convex/football/sportmonks/sportmonks";
import { mapSportmonksMatch, smScoreRead } from "../../../../convex/football/sportmonks/sportmonksMatch";
import { MISSING, NOT_IN_SPORTMONKS, SPORTMONKS_STAT_IDS, SPORTMONKS_STAT_TYPES } from "../../../../convex/football/sportmonks/sportmonksStats";
import { STAT_CATALOGUE } from "../../../../convex/scoring/statCatalogueList";
import { SM, sportmonksLiveRead, sportmonksSeason } from "../../../support/recorded/sportmonks.payloads";

const oldFirm = () => sportmonksLiveRead().data[0];

test("the season maps to the seam: clubs, each squad's men by Sportmonks' id, rounds as gameweeks and matches under them", () => {
  const football = mapSportmonks(sportmonksSeason());

  expect(football.clubs).toEqual([
    { code: SM.celtic, name: "Celtic", shortName: "CEL", stadium: "Celtic Park", capacity: 60411, manager: "Martin O'Neill" },
    { code: SM.rangers, name: "Rangers", shortName: "RAN", stadium: "Ibrox Stadium" },
    // Sportmonks sends no short code for Hearts: its name's first three letters stand in.
    { code: SM.hearts, name: "Heart of Midlothian", shortName: "HEA" },
  ]);
  expect(football.players).toEqual([
    { code: SM.schmeichel, name: "Kasper Schmeichel", fullName: "Kasper Schmeichel", clubCode: SM.celtic, availability: "out", news: "Hamstring Injury - Expected back 22 Nov" },
    // No display name: the common one stands in.
    { code: SM.kyogo, name: "Kyogo", fullName: "Kyogo Furuhashi", clubCode: SM.celtic, availability: "available", news: "" },
    { code: SM.tavernier, name: "James Tavernier", fullName: "James Tavernier", clubCode: SM.rangers, availability: "out", news: "Red Card Suspension" },
  ]);
  expect(football.gameweeks).toEqual([
    { season: 2026, number: 11, deadline: Date.parse("2026-11-01T15:00:00Z") },
    { season: 2026, number: 12, deadline: Date.parse("2026-11-08T12:00:00Z") },
  ]);
  expect(football.fixtures).toEqual([
    { code: SM.rangersHearts, gameweek: 11, homeClubCode: SM.rangers, awayClubCode: SM.hearts, kickoff: Date.parse("2026-11-01T15:00:00Z") },
    { code: SM.oldFirm, gameweek: 12, homeClubCode: SM.celtic, awayClubCode: SM.rangers, kickoff: Date.parse("2026-11-08T12:00:00Z") },
    // No timestamp: its UTC `starting_at` is read instead.
    { code: SM.heartsCeltic, gameweek: 12, homeClubCode: SM.hearts, awayClubCode: SM.celtic, kickoff: Date.parse("2026-11-09T15:00:00Z") },
  ]);
  expect(football.betweenSeasons).toBe(false);
  expect(football.scores).toEqual({
    reads: [
      { fixtureCode: SM.rangersHearts, state: "fullTime", homeGoals: 3, awayGoals: 0, minutes: null, clockLabel: null },
      { fixtureCode: SM.oldFirm, state: "live", homeGoals: 2, awayGoals: 1, minutes: null, clockLabel: null },
      { fixtureCode: SM.heartsCeltic, state: "upcoming", homeGoals: null, awayGoals: null, minutes: null, clockLabel: null },
    ],
    problems: [],
  });
});

// The club page's header names its stadium, capacity and manager (spec/18 `S18.7`).
test("a club's stadium, capacity and manager come from its venue and active coach; one Sportmonks doesn't send is left out (#1938)", () => {
  const byCode = new Map(mapSportmonks(sportmonksSeason()).clubs.map((club) => [club.code, club]));

  // The active spell's coach, a caretaker, never the past manager.
  expect(byCode.get(SM.celtic)).toMatchObject({ stadium: "Celtic Park", capacity: 60411, manager: "Martin O'Neill" });
  // No capacity and no coach sent: neither is made up.
  expect(byCode.get(SM.rangers)).not.toHaveProperty("capacity");
  expect(byCode.get(SM.rangers)).not.toHaveProperty("manager");
  // No venue or coaches at all.
  expect(byCode.get(SM.hearts)).toEqual({ code: SM.hearts, name: "Heart of Midlothian", shortName: "HEA" });

  // Of two active spells, the one started last names the manager.
  const payloads = sportmonksSeason();
  const [celtic] = payloads.teams;
  const spell = (id: number, start: string, name: string) => ({ id, coach_id: id, active: true, start, coach: { id, name } });
  celtic.coaches = [spell(1, "2026-11-01", "New Man"), spell(2, "2025-10-28", "Old Man")];
  expect(mapSportmonks(payloads).clubs[0]).toMatchObject({ manager: "New Man" });
});

test("an open injury or suspension is out, with its name and expected return where sent; a finished one is not (#1420)", () => {
  const byCode = new Map(mapSportmonks(sportmonksSeason()).players.map((man) => [man.code, man]));

  // An open injury with a return date.
  expect(byCode.get(SM.schmeichel)).toMatchObject({ availability: "out", news: "Hamstring Injury - Expected back 22 Nov" });
  // A finished injury keeps no one out.
  expect(byCode.get(SM.kyogo)).toMatchObject({ availability: "available", news: "" });
  // An open suspension with no return date sent.
  expect(byCode.get(SM.tavernier)).toMatchObject({ availability: "out", news: "Red Card Suspension" });
});

test("of a man's two open sidelines the one ending last names him, and one with no type falls back on its category", () => {
  const payloads = sportmonksSeason();
  const [celtic] = payloads.teams;
  const extra = (id: number, end_date: string | null, type: { id: number; name: string } | null) => ({ id, player_id: SM.kyogo, category: "injury", end_date, completed: false, type });
  celtic.sidelined = [extra(911, "2026-12-01", { id: 1, name: "Knee Injury" }), extra(912, "2026-11-20", { id: 2, name: "Illness" })];
  expect(mapSportmonks(payloads).players.find(({ code }) => code === SM.kyogo)).toMatchObject({ availability: "out", news: "Knee Injury - Expected back 1 Dec" });

  celtic.sidelined.push(extra(913, null, null));
  expect(mapSportmonks(payloads).players.find(({ code }) => code === SM.kyogo)).toMatchObject({ availability: "out", news: "injury" });
});

test("rounds sharing a number across stages, as after the Scottish split, are one gameweek with the earliest kickoff", () => {
  const payloads = sportmonksSeason();
  const whole = mapSportmonks(sportmonksSeason());
  // Round 12's later match moves to a second stage's own round 12.
  const [stage] = payloads.schedule;
  const round = stage.rounds!.find(({ name }) => name === "12")!;
  const later = round.fixtures!.find(({ id }) => id === SM.heartsCeltic)!;
  round.fixtures = round.fixtures!.filter((match) => match !== later);
  payloads.schedule.push({ ...stage, rounds: [{ ...round, fixtures: [later] }] });

  const split = mapSportmonks(payloads);
  expect(split.gameweeks).toEqual(whole.gameweeks);
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
  noAway.schedule[0].rounds![0].fixtures![0].participants = [{ id: SM.rangers, meta: { location: "home" } }];
  expect(() => mapSportmonks(noAway)).toThrow(`Sportmonks sent match ${SM.rangersHearts} with no home or away club`);
});

test("a state Sportmonks hasn't been mapped for, or a live match with no running score, is a problem for the run row, never a score", () => {
  const abandoned = { ...oldFirm(), state_id: 15 };
  expect(() => smScoreRead(abandoned)).toThrow(`Sportmonks sent state 15 for match ${SM.oldFirm}`);
  const noScore = { ...oldFirm(), scores: [] };
  expect(() => smScoreRead(noScore)).toThrow(`Sportmonks sent no home score for match ${SM.oldFirm} at live`);
});

test("a live read maps to its score and clock, the lineups with each man's running totals, and the events by minute", () => {
  const { score, men, events } = mapSportmonksMatch(oldFirm());

  expect(score).toEqual({ fixtureCode: SM.oldFirm, state: "live", homeGoals: 2, awayGoals: 1, minutes: 67, clockLabel: null });
  expect(men).toEqual([
    {
      playerId: SM.schmeichel,
      teamId: SM.celtic,
      started: true,
      formationField: "1:1",
      formationPosition: 1,
      stats: [{ typeId: 119, value: 67 }, { typeId: 57, value: 3 }, { typeId: 88, value: 1 }],
    },
    {
      playerId: SM.kyogo,
      teamId: SM.celtic,
      started: true,
      formationField: "4:1",
      formationPosition: 9,
      stats: [{ typeId: 119, value: 67 }, { typeId: 52, value: 2 }, { typeId: 86, value: 3 }, { typeId: 118, value: 8.4 }],
    },
    { playerId: SM.mcCowan, teamId: SM.celtic, started: false, formationField: null, formationPosition: null, stats: [] },
    {
      playerId: SM.tavernier,
      teamId: SM.rangers,
      started: true,
      formationField: "3:2",
      formationPosition: 7,
      stats: [{ typeId: 119, value: 67 }, { typeId: 111, value: 1 }, { typeId: 84, value: 1 }],
    },
  ]);
  // Goal 12', goal 45+1', yellow 45+2', VAR then the penalty it gave at 55', the substitution at 68'.
  expect(events.map(({ id, typeId, minute, extraMinute }) => [id, typeId, minute, extraMinute])).toEqual([
    [502, 14, 12, null],
    [506, 14, 45, 1],
    [503, 19, 45, 2],
    [505, 10, 55, null],
    [504, 16, 55, null],
    [501, 18, 68, null],
  ]);
  expect(events.at(-1)).toEqual({
    id: 501,
    typeId: 18,
    minute: 68,
    extraMinute: null,
    teamId: SM.celtic,
    playerId: SM.mcCowan,
    relatedPlayerId: SM.kyogo,
    result: null,
    info: null,
    addition: null,
  });
});

test("a lineup type or a stat value not seen before throws, naming it, rather than be dropped", () => {
  const coach = oldFirm();
  coach.lineups![0].type_id = 13;
  expect(() => mapSportmonksMatch(coach)).toThrow(`Sportmonks sent lineup type 13 for player ${SM.schmeichel} in match ${SM.oldFirm}`);
  const shaped = oldFirm();
  shaped.lineups![0].details![0].data = { value: { total: 67 } };
  expect(() => mapSportmonksMatch(shaped)).toThrow(`Sportmonks sent stat 119 for player ${SM.schmeichel} in match ${SM.oldFirm} as {"total":67}`);
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
