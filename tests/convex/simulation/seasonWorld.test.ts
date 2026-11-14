import { expect, test } from "vitest";
import {
  SEASON_CLUBS,
  coversEveryPair,
  dealSquads,
  DOUBLE_GAMEWEEK,
  FIXTURES,
  LEAGUE_SIZES,
  squadLineOf,
  matchRecords,
  SEASON_PLAYERS,
  SEASON_GAMEWEEKS,
  seededRandom,
  SQUAD_SHAPE,
} from "../../support/convex/seasonSimulation.harness";

// The season simulation's world (#2132), checked on every pull request: `npm run simulate` plays it
// for about an hour, so a world that couldn't be played would only show there.

test("the leagues hold 80 teams, and their rules cover every pair of settings", () => {
  expect(LEAGUE_SIZES.reduce((sum, size) => sum + size, 0)).toBe(80);
  expect(coversEveryPair()).toBe(true);
});

test("the same seed plays the same season", () => {
  const draw = (seed: number) => {
    const random = seededRandom(seed);
    return Array.from({ length: 5 }, () => random());
  };
  expect(draw(7)).toEqual(draw(7));
  expect(draw(7)).not.toEqual(draw(8));
});

test("each gameweek every club plays once, and twice in the double gameweek", () => {
  for (let gameweek = 1; gameweek <= SEASON_GAMEWEEKS; gameweek += 1) {
    const clubs = FIXTURES.filter((fixture) => fixture.gameweek === gameweek).flatMap((fixture) => [fixture.homeClubCode, fixture.awayClubCode]);
    expect(new Set(clubs).size, `gameweek ${gameweek}`).toBe(SEASON_CLUBS.length);
    expect(clubs.length, `gameweek ${gameweek}`).toBe(SEASON_CLUBS.length + (gameweek === DOUBLE_GAMEWEEK ? 2 : 0));
  }
});

test("each team of the biggest league gets its squad's shape, no player twice", () => {
  const squads = dealSquads(seededRandom(1), Math.max(...LEAGUE_SIZES));
  const byCode = new Map(SEASON_PLAYERS.map((player) => [player.code, player]));
  expect(new Set(squads.flat()).size).toBe(squads.flat().length);
  for (const squad of squads) {
    const lines = Object.fromEntries(Object.keys(SQUAD_SHAPE).map((line) => [line, squad.filter((code) => squadLineOf(byCode.get(code)!) === line).length]));
    expect(lines).toEqual(SQUAD_SHAPE);
  }
});

test("a match's records are whole: every player of both clubs, eleven starting on each side", () => {
  const [fixture] = FIXTURES;
  const records = matchRecords(seededRandom(1), fixture);
  expect(records).toHaveLength(SEASON_PLAYERS.filter((player) => player.clubCode === fixture.homeClubCode || player.clubCode === fixture.awayClubCode).length);
  expect(records.filter((record) => record.started)).toHaveLength(22);
  expect(records.every((record) => record.arrived.fpl && record.arrived.pl)).toBe(true);
});
