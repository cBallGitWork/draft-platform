// Whether a lineup may stand (spec/05, The pitch; #8): one pure function, the league's rules always
// an argument. Storing a lineup, rolling it over and the screen are not here.
// It judges a lineup as a manager sets it, on the positions their players hold now. A starter who
// loses a position after he was placed stays in his slot for the gameweek, only warned (spec/06,
// When positions change): the deadline, rollover and auto team must not take that outsideHisAreas
// as illegal. It is reported alone, so a caller can set it aside; the rule is #23's to keep.

import { AREAS, LANES, playsCell, type Area, type Cell, type Lane } from "./pitch";
import type { Position } from "../positions/positionTables";

/** A football side's eleven: the product's rule, not a league's. */
export const STARTER_COUNT = 11;

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
export type PlayerPositions = ReadonlyMap<PlayerCode, readonly Position[]>;

/** Who stands in one cell: more than one is a problem. */
type CellStanding = Cell & { playerCodes: PlayerCode[] };

export type LineupProblem =
  | { kind: "wrongStarterCount"; starterCount: number }
  | { kind: "playerTwice"; playerCode: PlayerCode }
  | { kind: "noSuchCell"; playerCode: PlayerCode; area: string; lane: string }
  | ({ kind: "cellShared" } & CellStanding)
  | { kind: "positionsUnknown"; playerCode: PlayerCode }
  | { kind: "outsideHisAreas"; playerCode: PlayerCode; area: Area; lane: Lane; positions: readonly Position[] }
  | { kind: "aboveMaximum"; area: Area; starterCount: number; maximum: number }
  | { kind: "belowMinimum"; area: Area; starterCount: number; minimum: number };

const isArea = (area: string): area is Area => (AREAS as readonly string[]).includes(area);
const isLane = (lane: string): lane is Lane => (LANES as readonly string[]).includes(lane);

/** Every reason the lineup can't stand under these rules; none means it is legal. */
export function lineupProblems(lineup: Lineup, positions: PlayerPositions, rules: LineupRules): LineupProblem[] {
  throwOnInvalidAreaLimits(rules);
  const problems: LineupProblem[] = [];
  if (lineup.starters.length !== STARTER_COUNT) {
    problems.push({ kind: "wrongStarterCount", starterCount: lineup.starters.length });
  }

  const named = new Set<PlayerCode>();
  for (const playerCode of [...lineup.starters.map((starter) => starter.playerCode), ...lineup.bench]) {
    if (named.has(playerCode)) problems.push({ kind: "playerTwice", playerCode });
    named.add(playerCode);
  }

  const standing = new Map<string, CellStanding>();
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
    const starterCount = [...standing.values()]
      .filter((cell) => cell.area === area)
      .reduce((count, cell) => count + cell.playerCodes.length, 0);
    const { minimum, maximum } = rules.areaLimits[area];
    if (starterCount > maximum) problems.push({ kind: "aboveMaximum", area, starterCount, maximum });
    if (starterCount < minimum) problems.push({ kind: "belowMinimum", area, starterCount, minimum });
  }
  return problems;
}

/** An invalid limit is the league's mistake, not the manager's: it is thrown, never reported as
 *  a problem with their lineup. leagueRulesCheck.ts refuses it when the league sets it (#25). */
function throwOnInvalidAreaLimits(rules: LineupRules): void {
  for (const area of AREAS) {
    const { minimum, maximum } = rules.areaLimits[area];
    if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum < 0 || maximum < minimum) {
      throw new Error(`An area's limits are whole numbers, 0 ≤ minimum ≤ maximum, not ${area} ${minimum}–${maximum}`);
    }
  }
}
