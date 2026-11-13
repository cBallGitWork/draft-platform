// Sportmonks' real reads of 10 Nov 2026 as ours (#1391): what Sportmonks actually sends, beside
// sportmonks.test.ts's docs-shaped cases. Read before the venue, coaches and sidelined includes
// were asked for, and in the international break, so the match is finished, never live.

import { expect, test } from "vitest";
import { mapSportmonks } from "../../../../convex/football/sportmonks/sportmonks";
import { mapSportmonksMatch } from "../../../../convex/football/sportmonks/sportmonksMatch";
import { SM_REAL, sportmonksRealLiveRead, sportmonksRealSeason } from "../../../support/recorded/sportmonks.payloads";

test("a real season read maps to the seam: clubs, each squad's men by Sportmonks' id, rounds as gameweeks and matches under them", () => {
  const football = mapSportmonks(sportmonksRealSeason());

  expect(football.clubs.map(({ code, name, shortName }) => ({ code, name, shortName }))).toEqual([
    { code: SM_REAL.kilmarnock, name: "Kilmarnock", shortName: "KIL" },
    { code: SM_REAL.celtic, name: "Celtic", shortName: "CEL" },
    { code: SM_REAL.stMirren, name: "St. Mirren", shortName: "STM" },
  ]);
  expect(football.players.map(({ code, name, fullName, clubCode }) => ({ code, name, fullName, clubCode }))).toEqual([
    { code: SM_REAL.owen, name: "Ieuan Owen", fullName: "Ieuan Gwyn Owen", clubCode: SM_REAL.kilmarnock },
    { code: SM_REAL.trusty, name: "Auston Trusty", fullName: "Auston Trusty", clubCode: SM_REAL.celtic },
    { code: SM_REAL.donovan, name: "Colby Donovan", fullName: "Colby Donovan", clubCode: SM_REAL.celtic },
    // Sportmonks spells his display name and full name differently: the display name shows.
    { code: SM_REAL.ramsey, name: "Calvin Ramsay", fullName: "Calvin Ramsey", clubCode: SM_REAL.stMirren },
  ]);
  expect(football.gameweeks).toEqual([
    { season: 2026, number: 13, deadline: Date.parse("2026-11-08T16:00:00Z") },
    { season: 2026, number: 14, deadline: Date.parse("2026-11-21T15:00:00Z") },
    { season: 2026, number: 15, deadline: Date.parse("2026-11-28T15:00:00Z") },
  ]);
  expect(football.fixtures).toEqual([
    { code: SM_REAL.celticKilmarnock, gameweek: 13, homeClubCode: SM_REAL.celtic, awayClubCode: SM_REAL.kilmarnock, kickoff: Date.parse("2026-11-08T16:00:00Z") },
    { code: SM_REAL.celticStMirren, gameweek: 14, homeClubCode: SM_REAL.celtic, awayClubCode: SM_REAL.stMirren, kickoff: Date.parse("2026-11-21T15:00:00Z") },
    { code: SM_REAL.stMirrenKilmarnock, gameweek: 15, homeClubCode: SM_REAL.stMirren, awayClubCode: SM_REAL.kilmarnock, kickoff: Date.parse("2026-11-28T15:00:00Z") },
  ]);
  expect(football.betweenSeasons).toBe(false);
  expect(football.scores).toEqual({
    reads: [
      { fixtureCode: SM_REAL.celticKilmarnock, state: "fullTime", homeGoals: 1, awayGoals: 0, minutes: null, clockLabel: null },
      { fixtureCode: SM_REAL.celticStMirren, state: "upcoming", homeGoals: null, awayGoals: null, minutes: null, clockLabel: null },
      { fixtureCode: SM_REAL.stMirrenKilmarnock, state: "upcoming", homeGoals: null, awayGoals: null, minutes: null, clockLabel: null },
    ],
    problems: [],
  });
});

test("a real read of a finished match maps its lineups, each man's totals and its events, the captaincy sent as true held as 1", () => {
  const { score, men, events } = mapSportmonksMatch(sportmonksRealLiveRead().data[0]);

  // Read after full time: no period ticks, so no minute.
  expect(score).toEqual({ fixtureCode: SM_REAL.celticKilmarnock, state: "fullTime", homeGoals: 1, awayGoals: 0, minutes: null, clockLabel: null });
  expect(men).toHaveLength(40);
  expect(men.filter(({ started }) => started)).toHaveLength(22);
  expect(men.slice(0, 4).map(({ playerId, teamId, started, formationField, formationPosition }) => [playerId, teamId, started, formationField, formationPosition])).toEqual([
    [SM_REAL.sinisalo, SM_REAL.celtic, false, null, null],
    [SM_REAL.scales, SM_REAL.celtic, true, "2:3", 4],
    [SM_REAL.jota, SM_REAL.celtic, true, "4:3", 10],
    [SM_REAL.nygren, SM_REAL.celtic, true, "4:2", 9],
  ]);
  // An unused substitute carries no stats; the scorer his minutes (119), goal (52) and rating (118).
  expect(men[0].stats).toEqual([]);
  expect(men[1].stats).toEqual(expect.arrayContaining([{ typeId: 119, value: 90 }, { typeId: 52, value: 1 }, { typeId: 118, value: 8.15 }]));
  // Sportmonks sends the captaincy (40) as true: held as 1.
  const captain = men.find(({ playerId }) => playerId === SM_REAL.mcGregor)!;
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
    teamId: SM_REAL.celtic,
    playerId: SM_REAL.scales,
    relatedPlayerId: 37709508,
    result: "1-0",
    info: "Left foot shot",
    addition: "1st Goal",
  });
});
