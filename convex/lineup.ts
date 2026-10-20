// Whether a lineup may stand (spec/05, The pitch; #8): one pure function, the league's rules always
// an argument. Storing a lineup, rolling it over and the screen are not here.

import { AREAS, LANES, playsCell, type Area, type Lane, type PositionLabel } from "./pitch";

/** A football side's eleven: the product's rule, not a league's. */
export const STARTERS = 11;

/** Players are FPL's season-stable `code`. */
type PlayerCode = number;

/** Where a starter stands. Area and lane are plain strings here because a lineup arrives from a
 *  manager's browser: this check is what refuses a cell that doesn't exist. */
export interface Placement {
  playerCode: PlayerCode;
  area: string;
  lane: string;
}

export interface Lineup {
  starters: readonly Placement[];
  /** In the order auto-subs use. How many sit on it isn't a rule: it is the squad's rest. */
  bench: readonly PlayerCode[];
}

export interface AreaLimit {
  minimum: number;
  maximum: number;
}

/** The league's rules this check reads: each area's minimum and maximum on the pitch (spec/03).
 *  There are no defaults; a league sets all six. */
export interface LineupRules {
  areaLimits: Record<Area, AreaLimit>;
}

/** Each starter's positions. An unconfirmed position is passed like any other: it counts
 *  (spec/06). The bench's aren't read: where a sub may come on is the auto-subs' question. */
export type PlayerPositions = ReadonlyMap<PlayerCode, readonly PositionLabel[]>;

export type LineupProblem =
  | { kind: "wrongStarterCount"; starters: number }
  | { kind: "playerTwice"; playerCode: PlayerCode }
  | { kind: "noSuchCell"; playerCode: PlayerCode; area: string; lane: string }
  | { kind: "cellShared"; area: Area; lane: Lane; playerCodes: PlayerCode[] }
  | { kind: "positionsUnknown"; playerCode: PlayerCode }
  | { kind: "outsideHisAreas"; playerCode: PlayerCode; area: Area; lane: Lane; positions: readonly PositionLabel[] }
  | { kind: "aboveMaximum"; area: Area; starters: number; maximum: number }
  | { kind: "belowMinimum"; area: Area; starters: number; minimum: number };

const isArea = (area: string): area is Area => (AREAS as readonly string[]).includes(area);
const isLane = (lane: string): lane is Lane => (LANES as readonly string[]).includes(lane);

/** Every reason the lineup can't stand under these rules; none means it is legal. */
export function lineupProblems(lineup: Lineup, positions: PlayerPositions, rules: LineupRules): LineupProblem[] {
  checkAreaLimits(rules);
  const problems: LineupProblem[] = [];
  if (lineup.starters.length !== STARTERS) {
    problems.push({ kind: "wrongStarterCount", starters: lineup.starters.length });
  }

  const named = new Set<PlayerCode>();
  for (const playerCode of [...lineup.starters.map((starter) => starter.playerCode), ...lineup.bench]) {
    if (named.has(playerCode)) problems.push({ kind: "playerTwice", playerCode });
    named.add(playerCode);
  }

  const standing = new Map<string, { area: Area; lane: Lane; playerCodes: PlayerCode[] }>();
  for (const { playerCode, area, lane } of lineup.starters) {
    if (!isArea(area) || !isLane(lane)) {
      problems.push({ kind: "noSuchCell", playerCode, area, lane });
      continue;
    }
    const cellKey = `${area}/${lane}`;
    const cell = standing.get(cellKey) ?? { area, lane, playerCodes: [] };
    cell.playerCodes.push(playerCode);
    standing.set(cellKey, cell);

    const playerPositions = positions.get(playerCode);
    if (playerPositions === undefined) problems.push({ kind: "positionsUnknown", playerCode });
    else if (!playsCell(playerPositions, { area, lane })) {
      problems.push({ kind: "outsideHisAreas", playerCode, area, lane, positions: playerPositions });
    }
  }
  for (const cell of standing.values()) {
    if (cell.playerCodes.length > 1) problems.push({ kind: "cellShared", ...cell });
  }

  for (const area of AREAS) {
    const starters = [...standing.values()]
      .filter((cell) => cell.area === area)
      .reduce((count, cell) => count + cell.playerCodes.length, 0);
    const { minimum, maximum } = rules.areaLimits[area];
    if (starters > maximum) problems.push({ kind: "aboveMaximum", area, starters, maximum });
    if (starters < minimum) problems.push({ kind: "belowMinimum", area, starters, minimum });
  }
  return problems;
}

/** A limit that can't be met is the league's mistake, not the manager's: it is thrown, never
 *  reported as his lineup's problem. Refusing it when it is set is #25's. */
function checkAreaLimits(rules: LineupRules): void {
  for (const area of AREAS) {
    const { minimum, maximum } = rules.areaLimits[area];
    if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum < 0 || maximum < minimum) {
      throw new Error(`An area's limits are whole numbers, 0 ≤ minimum ≤ maximum, not ${area} ${minimum}–${maximum}`);
    }
  }
}
