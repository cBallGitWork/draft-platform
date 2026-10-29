// A team's gameweek tests' shared setup (#29): a three-man lineup and a two-man bench from
// recorded lines of Hull v Everton, gameweek 6 of 2026/27, scored under the tests' example set.

import { codesByOpta } from "../../../convex/football/feedIds";
import { fplStatLines } from "../../../convex/football/fpl/fplLive";
import { plStatLines } from "../../../convex/football/premierLeague/plMatch";
import type { Lineup } from "../../../convex/lineup/lineup";
import type { Cell } from "../../../convex/lineup/pitch";
import type { MatchStats } from "../../../convex/scoring/scoring";
import { scoreTeam, type GameweekMatches, type PlayerMatch, type TeamPointsInput } from "../../../convex/scoring/teamPoints";
import { FULL_STATS, hullEvertonReads, MATCH, recordedGw6, recordedPlFixture } from "../recorded/gw6.payloads";
import { centreOf, EXAMPLE_SET } from "./scoring.example";

const gw6 = recordedGw6();
const fplLines = fplStatLines(gw6.fpl.live, gw6.fpl.bootstrap.elements, gw6.fpl.fixtures);
const plLines = plStatLines(
  recordedPlFixture(MATCH.hullEverton.pl),
  hullEvertonReads(gw6),
  codesByOpta(gw6.fpl.bootstrap.elements),
).lines;

function recordOf(lines: { playerCode: number; stats: MatchStats }[], playerCode: number): MatchStats {
  const line = lines.find((each) => each.playerCode === playerCode);
  if (line === undefined) throw new Error(`no recorded line for player ${playerCode}`);
  return line.stats;
}

/** His recorded FPL line, which keeps every stat. */
export const fplRecordOf = (playerCode: number): MatchStats => recordOf(fplLines, playerCode);
/** His recorded Premier League line, which leaves most noughts out (docs/pl-match-stats.md). */
export const plRecordOf = (playerCode: number): MatchStats => recordOf(plLines, playerCode);

export const TZOLAKIS = 473284; // Hull's keeper: 4 saves, 2 conceded, 90 minutes
export const DEWSBURY_HALL = 215413; // Everton: 90 minutes, a goal, an assist, 10 defensive actions
export const GELHARDT = 462635; // Hull: 64 minutes, a goal
export const COYLE = FULL_STATS.coyle.code; // Hull's right back
export const PHILLIPS = FULL_STATS.phillips.code; // Hull's keeper, an unused substitute
export const BELLOUMI = FULL_STATS.belloumi.code; // Hull, on at 64 minutes: 26 minutes, a goal

export const KEEPER: Cell = centreOf("goalkeeper");
export const MIDFIELD: Cell = centreOf("midfield");
export const ATTACK: Cell = centreOf("attack");
export const RIGHT_BACK: Cell = { area: "defence", lane: "right" };

/** A final match with his recorded FPL line. */
export const finalMatch = (playerCode: number): PlayerMatch => ({
  record: fplRecordOf(playerCode),
  final: true,
});
export const NOT_ARRIVED: PlayerMatch = { record: null, final: false };

export const LINEUP: Lineup = {
  starters: [
    { playerCode: TZOLAKIS, ...KEEPER },
    { playerCode: DEWSBURY_HALL, ...MIDFIELD },
    { playerCode: GELHARDT, ...ATTACK },
  ],
  bench: [BELLOUMI, PHILLIPS],
};

const BENCH_CELLS: ReadonlyMap<number, Cell> = new Map([
  [BELLOUMI, MIDFIELD],
  [PHILLIPS, KEEPER],
]);

export const ALL_FINAL: GameweekMatches = new Map([
  [TZOLAKIS, [finalMatch(TZOLAKIS)]],
  [DEWSBURY_HALL, [finalMatch(DEWSBURY_HALL)]],
  [GELHARDT, [finalMatch(GELHARDT)]],
  [BELLOUMI, [finalMatch(BELLOUMI)]],
  [PHILLIPS, [finalMatch(PHILLIPS)]],
]);

/** Every match final but this player's, which are these. */
export const withMatches = (playerCode: number, matches: PlayerMatch[]): GameweekMatches =>
  new Map([...ALL_FINAL, [playerCode, matches]]);

/** The team scored with every match final, both matches counting and no substitutions, but for
 *  what `changes` says. */
export function team(changes: Partial<TeamPointsInput> = {}) {
  return scoreTeam({
    lineup: LINEUP,
    matches: ALL_FINAL,
    set: EXAMPLE_SET,
    doubleGameweekRule: "bothMatches",
    substitutions: [],
    benchCells: BENCH_CELLS,
    ...changes,
  });
}
