// A team's points for one gameweek (spec/14, On screen; spec/05, Auto-subs; #29): one pure
// function over the lineup, each player's matches, the site's scoring set and the league's
// double-gameweek rule. Who came on for whom is an argument, decided by the auto-subs; storing
// the points, the query and the screen are not here.

import type { Lineup } from "../lineup/lineup";
import type { Cell } from "../lineup/pitch";
import { inTenths, type ScoringSet } from "./scoringSet";
import { scoreGameweek, scoreMatch, type DoubleGameweekRule, type MatchPoints, type MatchStats } from "./scoring";

/** Players are FPL's season-stable `code`. */
type PlayerCode = number;

/** One of a player's matches in the gameweek: his record, null until it has arrived, and whether
 *  the match is final, which is the match's own state (spec/07, Match stats), not his record's. */
export interface PlayerMatch {
  record: MatchStats | null;
  final: boolean;
}

/** Each player's matches in the gameweek, one per fixture his club plays: none in a blank
 *  gameweek, two in a double. Every player the lineup names must have an entry. */
export type GameweekMatches = ReadonlyMap<PlayerCode, readonly PlayerMatch[]>;

/** A bench player who came on for a starter, and the cell he plays: the starter's own, or his own
 *  area's when no one could take that slot and the formation changed (spec/05, Auto-subs). */
export interface Substitution {
  off: PlayerCode;
  on: PlayerCode;
  cell: Cell;
}

export interface TeamPointsInput {
  lineup: Lineup;
  matches: GameweekMatches;
  set: ScoringSet;
  doubleGameweekRule: DoubleGameweekRule;
  /** None means every starter counts. */
  substitutions: readonly Substitution[];
  /** The cell each bench player's greyed points are priced at while he hasn't come on: he has no
   *  slot of his own, so the caller says which (#29, Left for later). */
  benchCells: ReadonlyMap<PlayerCode, Cell>;
}

/** One player's gameweek in the team. */
export interface SlotPoints {
  playerCode: PlayerCode;
  /** The cell he is priced at: his slot, the one he came on in, or his bench cell. */
  cell: Cell;
  /** Whether his points count in the total: a starter not subbed off, or a sub who came on. A
   *  bench player who didn't is shown greyed (spec/14, On screen); so is a starter subbed off. */
  counts: boolean;
  /** Each match's points by category, in the order his matches came. */
  matches: MatchPoints[];
  /** His gameweek under the double-gameweek rule; null ("—") while none of his records has arrived. */
  points: number | null;
  /** While any of his records hasn't arrived or any of his matches isn't final. */
  provisional: boolean;
}

export interface TeamPoints {
  /** In the lineup's order. */
  starters: SlotPoints[];
  /** In the bench order. */
  bench: SlotPoints[];
  /** What counts, added up: the points of the records that have arrived. */
  total: number;
  /** While anyone who counts is provisional. */
  provisional: boolean;
}

/**
 * A team's gameweek. Starters count unless subbed off; bench players count only once subbed on,
 * and their points are shown either way. A substitution naming a non-starter, a non-bench player,
 * a player twice, or a cell someone who counts already stands in throws, as does a player with no
 * entry in `matches` or a bench player with no cell: never a silent 0.
 */
export function scoreTeam(input: TeamPointsInput): TeamPoints {
  const { lineup, substitutions, benchCells } = input;
  const cameOn = substitutionsByPlayer(lineup, substitutions);

  const starters = lineup.starters.map((starter) => {
    const cell = { area: starter.area, lane: starter.lane } as Cell;
    return slotPoints(input, starter.playerCode, cell, !cameOn.subbedOff.has(starter.playerCode));
  });
  const bench = lineup.bench.map((playerCode) => {
    const substitution = cameOn.subbedOn.get(playerCode);
    if (substitution !== undefined) return slotPoints(input, playerCode, substitution.cell, true);
    const cell = benchCells.get(playerCode);
    if (cell === undefined) throw new Error(`bench player ${playerCode} has no cell to price his points at`);
    return slotPoints(input, playerCode, cell, false);
  });

  const counting = [...starters, ...bench].filter((slot) => slot.counts);
  throwOnSharedCell(counting);
  return {
    starters,
    bench,
    total: inTenths(counting.reduce((total, slot) => total + (slot.points ?? 0), 0)),
    provisional: counting.some((slot) => slot.provisional),
  };
}

function slotPoints(input: TeamPointsInput, playerCode: PlayerCode, cell: Cell, counts: boolean): SlotPoints {
  const playerMatches = input.matches.get(playerCode);
  if (playerMatches === undefined) throw new Error(`player ${playerCode} has no entry in the gameweek's matches`);
  const matches = playerMatches.map((match) => scoreMatch(match.record, input.set, cell));
  const gameweek = scoreGameweek(matches, input.doubleGameweekRule);
  const provisional = gameweek.provisional || playerMatches.some((match) => !match.final);
  return {
    playerCode,
    cell,
    counts,
    matches,
    points: gameweek.points,
    provisional,
  };
}

interface SubstitutionsByPlayer {
  subbedOff: Set<PlayerCode>;
  subbedOn: Map<PlayerCode, Substitution>;
}

function substitutionsByPlayer(lineup: Lineup, substitutions: readonly Substitution[]): SubstitutionsByPlayer {
  const starters = new Set(lineup.starters.map((starter) => starter.playerCode));
  const bench = new Set(lineup.bench);
  const subbedOff = new Set<PlayerCode>();
  const subbedOn = new Map<PlayerCode, Substitution>();
  for (const substitution of substitutions) {
    const { off, on } = substitution;
    if (!starters.has(off)) throw new Error(`player ${off} is subbed off but isn't a starter`);
    if (!bench.has(on)) throw new Error(`player ${on} comes on but isn't on the bench`);
    if (subbedOff.has(off)) throw new Error(`player ${off} is subbed off twice`);
    if (subbedOn.has(on)) throw new Error(`player ${on} comes on twice`);
    subbedOff.add(off);
    subbedOn.set(on, substitution);
  }
  return { subbedOff, subbedOn };
}

/** Two who count in one cell is a substitution into a slot still filled. */
function throwOnSharedCell(counting: readonly SlotPoints[]): void {
  const standing = new Map<string, PlayerCode>();
  for (const { playerCode, cell } of counting) {
    const cellKey = `${cell.area}/${cell.lane}`;
    const other = standing.get(cellKey);
    if (other !== undefined) throw new Error(`players ${other} and ${playerCode} both count in ${cellKey}`);
    standing.set(cellKey, playerCode);
  }
}
