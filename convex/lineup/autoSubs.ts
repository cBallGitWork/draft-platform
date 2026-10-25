// Auto-subs (spec/05, Auto-subs; #12): one pure function, run again whenever a match ends, so
// its answer is provisional until every match of the gameweek is over, then final. Roles aren't
// built (#10, #11): a sub's role, the slot's or his best-star one, is told by `into` for them.
// Storing the result, scoring it and showing it are not here.

import { lineupProblems, type Lineup, type LineupRules, type Placement, type PlayerPositions } from "./lineup";
import { AREAS, LANES, playsCell, type Area, type Cell, type Lane } from "./pitch";

/** Players are FPL's season-stable `code`. */
type PlayerCode = number;

/** Whether a player played in the gameweek. Known only once he has: until his last match ends on
 *  0 minutes, he is still to play. */
export type GameweekPlay = "played" | "didNotPlay" | "stillToPlay";

/** One of a player's matches in the gameweek: two in a double gameweek, none in a blank one. */
export interface PlayerMatch {
  finished: boolean;
  minutes: number;
}

/** A player who plays in either match of a double gameweek played; one whose every match ended
 *  with him on 0 minutes didn't. With no match at all he didn't play. */
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
  /** After the substitutions: each player off sits on the bench where his sub sat. Always legal. */
  lineup: Lineup;
}

/** The substitutions for every starter who didn't play, back to front and left to right, and the
 *  lineup they leave. There is no limit on them (spec/05). */
export function autoSubs(
  lineup: Lineup,
  /** The bench's as well as the starters'. */
  positions: PlayerPositions,
  plays: ReadonlyMap<PlayerCode, GameweekPlay>,
  rules: LineupRules,
): AutoSubs {
  const problems = standingProblems(lineup, positions, rules);
  if (problems.length > 0) {
    throw new Error(`Auto-subs start from a lineup that may stand, not one with ${problems.map((p) => p.kind).join(", ")}`);
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
  return { substitutions, unfilled, lineup: current };
}

/** The first on the bench who can play the slot takes it. If none can, the first who keeps the
 *  area limits legal comes on in his own area; a keeper is replaced only by a keeper. */
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
    const tried = tryOn(lineup, absentee, playerCode, slot, "theSlot", positions, rules);
    if (tried) return tried;
  }
  if (slot.area === "goalkeeper") return undefined;

  const freeCells = freeCellsNearest(lineup, absentee);
  for (const playerCode of available) {
    const playerPositions = positionsOf(positions, playerCode);
    for (const cell of freeCells.filter((free) => playsCell(playerPositions, free))) {
      const tried = tryOn(lineup, absentee, playerCode, cell, "hisOwnArea", positions, rules);
      if (tried) return tried;
    }
  }
  return undefined;
}

/** The substitution, if the lineup it leaves may stand. */
function tryOn(
  lineup: Lineup,
  absentee: Placement,
  playerCode: PlayerCode,
  cell: Cell,
  into: Substitution["into"],
  positions: PlayerPositions,
  rules: LineupRules,
): { substitution: Substitution; lineup: Lineup } | undefined {
  const after: Lineup = {
    starters: lineup.starters.map((starter) => (starter === absentee ? { playerCode, ...cell } : starter)),
    bench: lineup.bench.map((benched) => (benched === playerCode ? absentee.playerCode : benched)),
  };
  if (standingProblems(after, positions, rules).length > 0) return undefined;
  return { substitution: { off: absentee.playerCode, on: playerCode, ...cell, into }, lineup: after };
}

/** Every cell no other starter stands in, nearest the absentee's first: the fewest areas away,
 *  then the fewest lanes, then the further back and the further left. */
function freeCellsNearest(lineup: Lineup, absentee: Placement): Cell[] {
  const slot = cellOf(absentee);
  const taken = new Set(
    lineup.starters.filter((starter) => starter !== absentee).map(({ area, lane }) => `${area}/${lane}`),
  );
  const distance = (cell: Cell): number[] => [
    Math.abs(AREAS.indexOf(cell.area) - AREAS.indexOf(slot.area)),
    Math.abs(LANES.indexOf(cell.lane) - LANES.indexOf(slot.lane)),
    AREAS.indexOf(cell.area),
    LANES.indexOf(cell.lane),
  ];
  return AREAS.flatMap((area) => LANES.map((lane) => ({ area, lane })))
    .filter(({ area, lane }) => !taken.has(`${area}/${lane}`))
    .sort((one, other) => compareInOrder(distance(one), distance(other)));
}

function compareInOrder(one: number[], other: number[]): number {
  const differing = one.findIndex((value, index) => value !== other[index]);
  return differing === -1 ? 0 : one[differing] - other[differing];
}

const byPitchOrder = (one: Placement, other: Placement): number => {
  const [first, second] = [cellOf(one), cellOf(other)];
  return compareInOrder(
    [AREAS.indexOf(first.area), LANES.indexOf(first.lane)],
    [AREAS.indexOf(second.area), LANES.indexOf(second.lane)],
  );
};

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
