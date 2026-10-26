// Auto-subs (spec/05, Auto-subs; #12): one pure function, run again whenever a match ends, so
// its answer is provisional until every match of the gameweek is over, then final. Roles aren't
// built (#10, #11): a sub's role, the slot's or his best-star one, is told by `into` for them.
// Storing the result, scoring it and showing it are not here.

import {
  STARTER_COUNT,
  lineupProblems,
  type Lineup,
  type LineupProblem,
  type LineupRules,
  type Placement,
  type PlayerPositions,
} from "./lineup";
import { AREAS, LANES, playsCell, type Area, type Cell, type Lane } from "./pitch";

/** Players are FPL's season-stable `code`. */
type PlayerCode = number;

/** Only a keeper plays in goal and he plays only there, so he is replaced only by a keeper and
 *  never comes on for anyone else (spec/05). */
const GOALKEEPER: Area = "goalkeeper";

/** Whether a player played in the gameweek. Known only once he has: until his last match ends on
 *  0 minutes, he is still to play. */
export type GameweekPlay = "played" | "didNotPlay" | "stillToPlay";

/** One of a player's matches in the gameweek: two in a double gameweek, none in a blank one. */
export interface PlayerMatch {
  finished: boolean;
  minutes: number;
}

/** A player who plays in either match of a double gameweek played; one whose every match ended
 *  with him on 0 minutes didn't. With no match at all he didn't play, so pass none only once his
 *  club's fixtures are known; a match postponed but still passed keeps him still to play. */
export function gameweekPlay(matches: readonly PlayerMatch[]): GameweekPlay {
  if (matches.some((match) => match.minutes > 0)) return "played";
  return matches.every((match) => match.finished) ? "didNotPlay" : "stillToPlay";
}

export interface Substitution {
  off: PlayerCode;
  on: PlayerCode;
  area: Area;
  lane: Lane;
  /** "theSlot": he took the empty slot and will take its role. "hisOwnArea": no one on the bench
   *  could play the slot, so he came on elsewhere, on his best-star role, and the formation changed. */
  into: "theSlot" | "hisOwnArea";
}

export interface AutoSubs {
  substitutions: Substitution[];
  /** Starters who didn't play and whom no one could replace legally: each one's slot scores nothing. */
  unfilled: PlayerCode[];
  /** After the substitutions: each player off sits on the bench where his sub sat. No sub makes it
   *  less legal than it started, so a legal lineup stays legal. */
  lineup: Lineup;
  /** What the lineup carried in and still carries: fewer than eleven, or area limits a later rules
   *  change broke. Empty when it may stand, a starter who lost a position aside (spec/06). */
  carriedProblems: LineupProblem[];
}

/** What a saved lineup can carry into a gameweek (#392): a player who left the squad leaves his
 *  cell empty, and a later rules change isn't checked against it. Auto-subs work around both and
 *  never add a starter: they replace only one who didn't play, though a sub coming on in his own
 *  area may stand in an empty cell. Any other problem is data gone wrong, and is thrown. */
const CARRIED_KINDS: ReadonlySet<LineupProblem["kind"]> = new Set(["wrongStarterCount", "belowMinimum", "aboveMaximum"]);

/** The substitutions for every starter who didn't play, back to front and left to right, and the
 *  lineup they leave. There is no limit on them (spec/05). */
export function autoSubs(
  lineup: Lineup,
  /** The bench's as well as the starters'. */
  positions: PlayerPositions,
  plays: ReadonlyMap<PlayerCode, GameweekPlay>,
  rules: LineupRules,
): AutoSubs {
  const corrupt = standingProblems(lineup, positions, rules).filter(
    (problem) => !CARRIED_KINDS.has(problem.kind) || (problem.kind === "wrongStarterCount" && problem.starterCount > STARTER_COUNT),
  );
  if (corrupt.length > 0) {
    throw new Error(`Auto-subs can't work round ${corrupt.map((problem) => problem.kind).join(", ")}`);
  }
  const playOf = (playerCode: PlayerCode): GameweekPlay => {
    const play = plays.get(playerCode);
    if (play === undefined) throw new Error(`Auto-subs need to know whether player ${playerCode} played`);
    return play;
  };
  // Asked of everyone at once, so a gap in what the caller knows fails every time, not only on
  // the day a sub is needed.
  for (const starter of lineup.starters) playOf(starter.playerCode);
  for (const playerCode of lineup.bench) {
    playOf(playerCode);
    positionsOf(positions, playerCode);
  }

  const absentees = lineup.starters.filter((starter) => playOf(starter.playerCode) === "didNotPlay").sort(byPitchOrder);
  let current = lineup;
  const substitutions: Substitution[] = [];
  const unfilled: PlayerCode[] = [];
  for (const absentee of absentees) {
    // A sub who hasn't played yet may still: he comes on provisionally, and keeps the bench's order.
    const available = current.bench.filter((playerCode) => playOf(playerCode) !== "didNotPlay");
    const sub = firstLegalSub(current, absentee, available, positions, rules);
    if (sub === undefined) unfilled.push(absentee.playerCode);
    else {
      substitutions.push(sub.substitution);
      current = sub.lineup;
    }
  }
  return { substitutions, unfilled, lineup: current, carriedProblems: standingProblems(current, positions, rules) };
}

/** The first on the bench who can play the slot takes it. If none can, the first who keeps the
 *  area limits legal comes on in his own area. */
function firstLegalSub(
  lineup: Lineup,
  absentee: Placement,
  available: readonly PlayerCode[],
  positions: PlayerPositions,
  rules: LineupRules,
): { substitution: Substitution; lineup: Lineup } | undefined {
  const slot = cellOf(absentee);
  // The hard rule (spec/05): a wing back plays only the wide lanes of a midfield row, so "can play
  // the slot's area" means can stand in the slot's own cell.
  for (const playerCode of available) {
    if (!playsCell(positionsOf(positions, playerCode), slot)) continue;
    const tried = legalSubstitution(lineup, absentee, playerCode, slot, "theSlot", positions, rules);
    if (tried) return tried;
  }
  if (slot.area === GOALKEEPER) return undefined;

  const freeCells = freeCellsNearest(lineup, absentee);
  for (const playerCode of available) {
    const playerPositions = positionsOf(positions, playerCode);
    for (const cell of freeCells.filter((free) => playsCell(playerPositions, free))) {
      const tried = legalSubstitution(lineup, absentee, playerCode, cell, "hisOwnArea", positions, rules);
      if (tried) return tried;
    }
  }
  return undefined;
}

/** The substitution, if it leaves the lineup no less legal than it was. */
function legalSubstitution(
  lineup: Lineup,
  absentee: Placement,
  playerCode: PlayerCode,
  cell: Cell,
  into: Substitution["into"],
  positions: PlayerPositions,
  rules: LineupRules,
): { substitution: Substitution; lineup: Lineup } | undefined {
  const after: Lineup = {
    // Into the absentee's own slot he takes its role too (spec/05 Auto-subs); elsewhere he plays
    // the new slot's first, until stars choose his best.
    starters: lineup.starters.map((starter) => {
      if (starter !== absentee) return starter;
      const sameSlot = cell.area === absentee.area && cell.lane === absentee.lane;
      return sameSlot && absentee.role !== undefined ? { playerCode, ...cell, role: absentee.role } : { playerCode, ...cell };
    }),
    bench: lineup.bench.map((benched) => (benched === playerCode ? absentee.playerCode : benched)),
  };
  if (isWorse(standingProblems(after, positions, rules), standingProblems(lineup, positions, rules))) return undefined;
  return { substitution: { off: absentee.playerCode, on: playerCode, ...cell, into }, lineup: after };
}

/** Every outfield cell no other starter stands in, nearest the absentee's first: the fewest areas away,
 *  then the fewest lanes, then the further back and the further left. */
function freeCellsNearest(lineup: Lineup, absentee: Placement): Cell[] {
  const [slotArea, slotLane] = pitchOrder(cellOf(absentee));
  const taken = new Set(lineup.starters.filter((starter) => starter !== absentee).map(cellOf).map(cellKey));
  const distance = (cell: Cell): number[] => {
    const [area, lane] = pitchOrder(cell);
    return [Math.abs(area - slotArea), Math.abs(lane - slotLane), area, lane];
  };
  return AREAS.flatMap((area) => LANES.map((lane) => ({ area, lane })))
    .filter((cell) => cell.area !== GOALKEEPER && !taken.has(cellKey(cell)))
    .sort((one, other) => compareInOrder(distance(one), distance(other)));
}

const cellKey = ({ area, lane }: Cell): string => `${area}/${lane}`;

/** Back to front, then left to right. */
const pitchOrder = ({ area, lane }: Cell): [number, number] => [AREAS.indexOf(area), LANES.indexOf(lane)];

function compareInOrder(one: number[], other: number[]): number {
  const differing = one.findIndex((value, index) => value !== other[index]);
  return differing === -1 ? 0 : one[differing] - other[differing];
}

const byPitchOrder = (one: Placement, other: Placement): number =>
  compareInOrder(pitchOrder(cellOf(one)), pitchOrder(cellOf(other)));

/** Whether `after` has a problem `before` hadn't, or any further from legal: a limit missed by more
 *  players. */
function isWorse(after: LineupProblem[], before: LineupProblem[]): boolean {
  const shortfalls = new Map(before.map((problem) => [problemKey(problem), shortfall(problem)]));
  return after.some((problem) => shortfall(problem) > (shortfalls.get(problemKey(problem)) ?? 0));
}

/** The same problem before and after a sub: per area for a limit. */
const problemKey = (problem: LineupProblem): string => ("area" in problem ? `${problem.kind}/${problem.area}` : problem.kind);

/** How many players a problem is from legal. */
function shortfall(problem: LineupProblem): number {
  switch (problem.kind) {
    case "belowMinimum":
      return problem.minimum - problem.starterCount;
    case "aboveMaximum":
      return problem.starterCount - problem.maximum;
    case "wrongStarterCount":
      return Math.abs(STARTER_COUNT - problem.starterCount);
    default:
      // The rest were thrown or set aside before any sub, and a sub never makes them.
      throw new Error(`A sub can't be weighed against ${problem.kind}`);
  }
}

/** A lineup that may stand, minus a starter outside his areas: one who lost a position after he
 *  was placed stays in his slot for the gameweek (spec/06), and lineup.ts reports it alone so a
 *  caller can set it aside. A sub is only ever put where he plays. */
function standingProblems(lineup: Lineup, positions: PlayerPositions, rules: LineupRules) {
  return lineupProblems(lineup, positions, rules).filter((problem) => problem.kind !== "outsideHisAreas");
}

/** A starter's cell, once standingProblems has refused any cell that doesn't exist. */
function cellOf(placement: Placement): Cell {
  const area = AREAS.find((known) => known === placement.area);
  const lane = LANES.find((known) => known === placement.lane);
  if (area === undefined || lane === undefined) throw new Error(`No cell ${placement.area}, ${placement.lane}`);
  return { area, lane };
}

function positionsOf(positions: PlayerPositions, playerCode: PlayerCode) {
  const playerPositions = positions.get(playerCode);
  if (playerPositions === undefined) throw new Error(`Auto-subs need player ${playerCode}'s positions`);
  return playerPositions;
}
