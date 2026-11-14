// The season simulation's world (#2132, `npm run simulate`): a seeded random season of the Premier
// League, held in the tables the football sync and the match-stats sync fill, and six leagues of
// 80 teams in all whose rules cover every pair of settings between them. Nothing here is a test:
// tests/convex/simulation/season.sim.ts plays the season through and asserts.
//
// The football rows stand in for the feeds: clubs, players, fixtures and gameweeks are written
// once, as the football sync holds them, and each match's records go in through the match-stats
// sync's own write (`upsertMatch`), so its lock, the leagues' stored scores and every job after
// run as on the live site.

import { WEEK_MS, HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import { ASSISTS, CLEAN_SHEETS, GOALS, GOALS_CONCEDED, MINUTES_STAT, SAVES } from "../../../convex/scoring/statKeys";
import type { Position } from "../../../convex/positions/positionTables";
import { WAIVER_ORDERS, type LeagueRules } from "../../../convex/rules/leagueRulesShape";
import { DOUBLE_GAMEWEEK_RULES } from "../../../convex/scoring/values";
import { ODD_TEAM_OUTS } from "../../../convex/table/roundRobin";
import { PL_GAMEWEEKS, type Club, type HeldPlayer } from "./footballRows.harness";

/** The seed the run plays, from SIM_SEED when it is set, so a red run can be played again. */
export const simulationSeed = (): number => {
  const set = process.env.SIM_SEED;
  return set === undefined || set === "" ? Math.floor(Math.random() * 2 ** 31) : Number(set);
};

/** A seeded random number in [0, 1), Mulberry32: the same seed plays the same season. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 2 ** 32;
  };
}

export type Random = ReturnType<typeof seededRandom>;
/** A whole number from 0 to `below` - 1. */
export const below = (random: Random, count: number) => Math.floor(random() * count);
export const pickOne = <Item>(random: Random, items: readonly Item[]): Item => items[below(random, items.length)];

/** The season's gameweeks: the Premier League's 38 and one more, as a season may hold (#1618). */
export const SEASON_GAMEWEEKS = PL_GAMEWEEKS + 1;
/** The gameweek whose two clubs play twice, so a double gameweek is scored under each rule. */
export const DOUBLE_GAMEWEEK = 30;
/** The gameweek from which each league's commissioner changes its rules, mid-season. */
export const RULES_CHANGE_GAMEWEEK = 20;

const CLUB_COUNT = 20;
/** Where the simulation's codes start: none meets a recorded or another test's player or match. */
const CLUB_CODES = 700;
const PLAYER_CODES = 40_000;
const FIXTURE_CODES = 60_000;

export const SEASON_CLUBS: Club[] = Array.from({ length: CLUB_COUNT }, (_, index) => ({
  code: CLUB_CODES + index,
  name: `Sim Club ${index + 1}`,
  shortName: `S${String(index + 1).padStart(2, "0")}`,
}));

/** Each club's 25, by the positions the admin sets for them: what a first lineup's 4-4-2 needs and
 *  more. */
const CLUB_POSITIONS: Position[] = [
  ...Array<Position>(2).fill("GK"),
  ...Array<Position>(5).fill("CB"),
  ...Array<Position>(3).fill("FB"),
  ...Array<Position>(4).fill("CM"),
  ...Array<Position>(2).fill("CDM"),
  ...Array<Position>(2).fill("WM"),
  ...Array<Position>(2).fill("CAM"),
  ...Array<Position>(2).fill("W"),
  ...Array<Position>(3).fill("ST"),
];

export const SEASON_PLAYERS: HeldPlayer[] = SEASON_CLUBS.flatMap((club, clubIndex) =>
  CLUB_POSITIONS.map((position, index) => {
    const code = PLAYER_CODES + clubIndex * 100 + index;
    return { code, name: `Player ${code}`, fullName: `Sim Player ${code}`, clubCode: club.code, positions: [position] };
  }),
);

/** A player's line on the pitch, as his one position puts him: for the squads' shape and his stats. */
export type SquadLine = "goalkeeper" | "defence" | "midfield" | "attack";
export const squadLineOf = (player: HeldPlayer): SquadLine => {
  const [position] = player.positions;
  if (position === "GK") return "goalkeeper";
  if (position === "CB" || position === "FB") return "defence";
  if (position === "ST") return "attack";
  return "midfield";
};

/** Each squad's shape: 14, the squad maximum of the biggest league, with enough in each line for
 *  the first lineup's 4-4-2 and a bench. */
export const SQUAD_SHAPE: Record<SquadLine, number> = { goalkeeper: 2, defence: 4, midfield: 5, attack: 3 };

export interface SeasonFixture {
  code: number;
  gameweek: number;
  homeClubCode: number;
  awayClubCode: number;
  kickoff: number;
}

/** The first kickoff of the season: a Saturday in August, 15:00 UK time. */
export const SEASON_START = Date.parse("2026-08-15T14:00:00Z");
/** The leagues are made, their squads assigned, a fortnight before it. */
export const LEAGUES_MADE_AT = SEASON_START - 2 * WEEK_MS;
/** Kickoffs within a gameweek: Saturday 15:00, 17:30, Sunday 14:00 and 16:30 UK time. */
const KICKOFF_SLOTS = [0, 2.5 * HOUR_MS, 23 * HOUR_MS, 25.5 * HOUR_MS];
/** From kickoff to the read that finds a match at full time. */
export const TO_FULL_TIME = 2 * HOUR_MS;

/** Each gameweek's kickoff for the match in `slot` of it. */
const kickoffAt = (gameweek: number, slot: number) => SEASON_START + (gameweek - 1) * WEEK_MS + KICKOFF_SLOTS[slot % KICKOFF_SLOTS.length];

/** The circle method's round `round` (0-based) of CLUB_COUNT clubs: each club once, home and away
 *  turned in the second half of the season. */
function round(round: number): [number, number][] {
  const others = Array.from({ length: CLUB_COUNT - 1 }, (_, index) => index + 1);
  const turned = [...others.slice(round % others.length), ...others.slice(0, round % others.length)];
  const circle = [0, ...turned];
  return Array.from({ length: CLUB_COUNT / 2 }, (_, index) => {
    const pair: [number, number] = [circle[index], circle[CLUB_COUNT - 1 - index]];
    return round >= CLUB_COUNT - 1 ? [pair[1], pair[0]] : pair;
  });
}

/** The season's fixtures: 38 rounds of the circle, the 39th the first again, and in
 *  DOUBLE_GAMEWEEK one extra match between the first two clubs, each playing twice. */
export const FIXTURES: SeasonFixture[] = (() => {
  const fixtures: SeasonFixture[] = [];
  for (let gameweek = 1; gameweek <= SEASON_GAMEWEEKS; gameweek += 1) {
    const pairs = round((gameweek - 1) % (2 * (CLUB_COUNT - 1)));
    if (gameweek === DOUBLE_GAMEWEEK) pairs.push([1, 0]);
    pairs.forEach(([home, away], slot) =>
      fixtures.push({
        code: FIXTURE_CODES + fixtures.length,
        gameweek,
        homeClubCode: SEASON_CLUBS[home].code,
        awayClubCode: SEASON_CLUBS[away].code,
        kickoff: kickoffAt(gameweek, slot),
      }),
    );
  }
  return fixtures;
})();

/** The minute after a gameweek's last match is read at full time. */
export const lastFullTime = (gameweek: number) =>
  Math.max(...FIXTURES.filter((fixture) => fixture.gameweek === gameweek).map((fixture) => fixture.kickoff)) + TO_FULL_TIME + MINUTE_MS;

export interface MatchRecord {
  playerCode: number;
  fixtureCode: number;
  started: boolean;
  played: boolean | null;
  arrived: { fpl: boolean; pl: boolean };
  stats: Record<string, number>;
}

/** One club's side of a match: its first eleven start (each line's first, by squad order), three of
 *  the rest come on, and the others sit unused. Goals and assists fall at random. */
function clubRecords(random: Random, fixtureCode: number, clubCode: number, conceded: number): MatchRecord[] {
  const squad = SEASON_PLAYERS.filter((player) => player.clubCode === clubCode);
  const starters = new Set([
    ...squad.filter((player) => squadLineOf(player) === "goalkeeper").slice(0, 1),
    ...squad.filter((player) => squadLineOf(player) === "defence").slice(0, 4),
    ...squad.filter((player) => squadLineOf(player) === "midfield").slice(0, 4),
    ...squad.filter((player) => squadLineOf(player) === "attack").slice(0, 2),
  ]);
  const subs = new Set(squad.filter((player) => !starters.has(player) && squadLineOf(player) !== "goalkeeper").slice(0, 3));
  return squad.map((player) => {
    const started = starters.has(player);
    const played = started || subs.has(player);
    const minutes = started ? 60 + below(random, 31) : played ? 1 + below(random, 30) : 0;
    const line = squadLineOf(player);
    const stats: Record<string, number> = { [MINUTES_STAT]: minutes };
    if (played) {
      const goals = line === "attack" ? below(random, 3) : line === "midfield" ? below(random, 2) : random() < 0.1 ? 1 : 0;
      if (goals > 0) stats[GOALS] = goals;
      if (random() < 0.15) stats[ASSISTS] = 1;
      if (line === "goalkeeper") stats[SAVES] = below(random, 6);
      if (line === "goalkeeper" || line === "defence") {
        if (conceded === 0 && minutes >= 60) stats[CLEAN_SHEETS] = 1;
        if (conceded > 0) stats[GOALS_CONCEDED] = conceded;
      }
    }
    return { playerCode: player.code, fixtureCode, started, played, arrived: { fpl: true, pl: true }, stats };
  });
}

/** Each held player's whole record of the match, both feeds' parts in: what the full-time read
 *  writes. */
export function matchRecords(random: Random, fixture: SeasonFixture): MatchRecord[] {
  const homeConceded = below(random, 4);
  const awayConceded = below(random, 4);
  return [...clubRecords(random, fixture.code, fixture.homeClubCode, homeConceded), ...clubRecords(random, fixture.code, fixture.awayClubCode, awayConceded)];
}

/** The six leagues, 80 teams in all: odd sizes among them, so the team left over plays. */
export const LEAGUE_SIZES = [20, 17, 15, 13, 9, 6];

/** Each rule a league's settings choose between two of (spec/03), in the leagues' order of
 *  LEAGUE_SIZES: every pair of two of them shows each of its four combinations in some league.
 *  Each column is a different six with three 1s and a 0 first, so no two are equal or opposite,
 *  and that is all a pair needs. */
const PAIRWISE: Record<string, number[]> = {
  format: [0, 1, 1, 1, 0, 0],
  gamesPerGameweek: [0, 1, 0, 0, 1, 1],
  oddTeamOut: [0, 0, 1, 0, 1, 1],
  doubleGameweek: [0, 0, 0, 1, 1, 1],
  waiverOrder: [0, 1, 1, 0, 1, 0],
};

/** Whether every pair of PAIRWISE's rules shows all four combinations across the leagues. */
export function coversEveryPair(): boolean {
  const columns = Object.values(PAIRWISE);
  return columns.every((one, index) =>
    columns.slice(index + 1).every((other) => [0, 1].every((a) => [0, 1].every((b) => one.some((value, league) => value === a && other[league] === b)))),
  );
}

const FORMATS: LeagueRules["format"][] = ["headToHead", "totalPoints"];
const GAMES = [1, 2];

/** The `league`th league's rules: `start`'s, with each of PAIRWISE's choices made. */
export function pairwiseRules(start: LeagueRules, league: number): LeagueRules {
  return {
    ...start,
    format: FORMATS[PAIRWISE.format[league]],
    gamesPerGameweek: GAMES[PAIRWISE.gamesPerGameweek[league]],
    oddTeamOut: ODD_TEAM_OUTS[PAIRWISE.oddTeamOut[league]],
    doubleGameweek: DOUBLE_GAMEWEEK_RULES[PAIRWISE.doubleGameweek[league]],
    waivers: { ...start.waivers, order: WAIVER_ORDERS[PAIRWISE.waiverOrder[league]] },
  };
}

/** The mid-season change: the games a gameweek, the double gameweek's rule and the deadline turned.
 *  The format stays, as it is locked once the season has begun (S03.1). */
export function changedMidSeason(rules: LeagueRules): LeagueRules {
  return {
    ...rules,
    gamesPerGameweek: rules.gamesPerGameweek === 1 ? 2 : 1,
    doubleGameweek: rules.doubleGameweek === "bothMatches" ? "bestMatch" : "bothMatches",
    deadline: { minutesBeforeFirstKickoff: rules.deadline.minutesBeforeFirstKickoff + 30 },
  };
}

/** The season's squads, for one league of `teams`: each team its SQUAD_SHAPE, dealt round the
 *  teams from a shuffle of each line, so each league's squads differ. */
export function dealSquads(random: Random, teams: number): number[][] {
  const squads: number[][] = Array.from({ length: teams }, () => []);
  for (const [line, each] of Object.entries(SQUAD_SHAPE) as [SquadLine, number][]) {
    const pool = SEASON_PLAYERS.filter((player) => squadLineOf(player) === line).map((player) => player.code);
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const other = below(random, index + 1);
      [pool[index], pool[other]] = [pool[other], pool[index]];
    }
    for (let team = 0; team < teams; team += 1) squads[team].push(...pool.slice(team * each, (team + 1) * each));
  }
  return squads;
}
