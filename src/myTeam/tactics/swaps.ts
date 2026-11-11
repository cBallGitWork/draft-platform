// Which swaps the Tactics tab offers and why one is refused (spec/05, Moving players): split from
// lineupEdits.ts, which makes the moves; this judges them. Whether a lineup may stand is still the
// server's (convex/lineup/lineup.ts), told as each move saves.

import { AREAS, GOALKEEPER_AREA, KEEPER_POSITION, playsCell, type Cell } from "../../../convex/lineup/pitch";
import { namedCodes, type LineupRules } from "../../../convex/lineup/lineup";
import type { Position } from "../../../convex/positions/positionTables";
import { standingIn, starts, swapped, type EditedLineup, type MoveRules, type RatingsOf } from "./lineupEdits";

/** No stars: for the checks below, which ask only whether a move may stand, never which role he plays. */
const NO_STARS: RatingsOf = () => [];

/** How far an area's starters fall outside its limits: 0 within them. */
function outsideLimits(draft: EditedLineup, area: Cell["area"], { areaLimits }: LineupRules): number {
  const count = draft.starters.filter((starter) => starter.area === area).length;
  const { minimum, maximum } = areaLimits[area];
  return Math.max(0, minimum - count, count - maximum);
}

/** Whether a move keeps the limits: no area further outside its own than before. A swap leaves
 *  every cell held as it was, so it never should; the check stays so that one never can (#1022). */
function keepsLimits(before: EditedLineup, after: EditedLineup, rules: LineupRules): boolean {
  return AREAS.every((area) => outsideLimits(after, area, rules) <= outsideLimits(before, area, rules));
}

/** Why a move is refused, which the line under the toolbar says (spec/05, The pitch; Craig,
 *  4 Nov 2026). Presets only, so nobody moves into an empty cell or leaves the pitch but by a swap;
 *  only a keeper plays in goal, and a keeper only there; each plays only the cells his positions
 *  play; and the area limits hold. */
export type MoveRefusal =
  | { kind: "emptyCell" }
  | { kind: "offThePitch" }
  | { kind: "goal" }
  | { kind: "doesNotPlay"; playerCode: number; cell: Cell }
  | { kind: "areaLimits" };

const isKeeper = (positions: readonly Position[]) => positions.includes(KEEPER_POSITION);

/** Why the two may not swap, null where they may: each plays the cell he lands in, and the limits
 *  hold. Two on the bench, or a player and himself, are no swap: the screen never asks. */
function swapRefusal(draft: EditedLineup, one: number, other: number, rules: MoveRules): MoveRefusal | null {
  const after = swapped(draft, one, other, NO_STARS);
  for (const starter of after.starters.filter(({ playerCode }) => playerCode === one || playerCode === other)) {
    const positions = rules.positionsOf(starter.playerCode);
    if (playsCell(positions, starter)) continue;
    if (starter.area === GOALKEEPER_AREA || isKeeper(positions)) return { kind: "goal" };
    return { kind: "doesNotPlay", playerCode: starter.playerCode, cell: { area: starter.area, lane: starter.lane } };
  }
  return keepsLimits(draft, after, rules) ? null : { kind: "areaLimits" };
}

/** Whether the two may swap (spec/05, Moving players): one starts, and the swap isn't refused. */
export function canSwap(draft: EditedLineup, one: number, other: number, rules: MoveRules): boolean {
  if (one === other || (!starts(draft, one) && !starts(draft, other))) return false;
  return swapRefusal(draft, one, other, rules) === null;
}

/** Where a dragged player lands: a cell of the pitch, a player's row, or the bench's plate. */
export type DropTarget = { cell: Cell } | { playerCode: number } | "bench";

/** Who a drop swaps the player picked up with, or why it is refused (spec/05; Craig, 1 and 4 Nov
 *  2026): an empty cell takes nobody, and a starter leaves the pitch only by a swap, so the bench's
 *  plate takes nobody either. A bench player dropped along the bench is put in order (benchedAt),
 *  never asked here. */
export function dropOutcome(draft: EditedLineup, playerCode: number, target: DropTarget, rules: MoveRules): { swapWith: number } | { refusal: MoveRefusal } {
  if (target === "bench") return { refusal: { kind: "offThePitch" } };
  const other = "cell" in target ? standingIn(draft, target.cell)?.playerCode : target.playerCode;
  if (other === undefined) return { refusal: { kind: "emptyCell" } };
  const refusal = swapRefusal(draft, playerCode, other, rules);
  return refusal === null ? { swapWith: other } : { refusal };
}

/** Everyone a picked-up player can swap with, on the pitch or the bench, each of whom lights up
 *  (spec/05, Moving players): there are no empty cells to move into. */
export interface Reach {
  players: number[];
}

export function reachOf(draft: EditedLineup, playerCode: number, rules: MoveRules): Reach {
  return { players: namedCodes(draft).filter((other) => canSwap(draft, playerCode, other, rules)) };
}

