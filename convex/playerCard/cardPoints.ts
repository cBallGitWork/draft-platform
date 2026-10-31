// What one of a player's matches is worth, priced with no lineup. The card shows his base points at
// each position he has (spec/12, The player card; Craig, 31 Oct 2026): pointsAt. The Squad tab,
// through scoredMatches.ts, prices a match no lineup counted at his best position: the slot his
// positions let him stand in (pitch.ts's playsCell) that scores the most for the match. Pure, so
// the queries and their tests price alike.

import { v, type Infer } from "convex/values";
import { ALL_CELLS, playsCell, positionOfSlot, SLOT_POSITIONS, type Cell, type SlotPosition } from "../lineup/pitch";
import { positionRank, type Position } from "../positions/positionTables";
import { scoreMatch, type MatchPoints } from "../scoring/scoring";
import type { MatchStats } from "../scoring/values";
import type { ScoringSet } from "../scoring/scoringSet";

/** How a match was priced: from his slot in a lineup, at his best position, or there but not
 *  counted: a bench player who didn't come on, at his best position, or his other match in a double
 *  gameweek that counts only his best, at his slot (spec/12, The player card). */
export const scoredAs = v.union(v.literal("slot"), v.literal("bestPosition"), v.literal("notCounted"));
export type ScoredAs = Infer<typeof scoredAs>;

export interface CardPoints extends MatchPoints {
  scoredAs: ScoredAs;
  /** The slot's position he was priced at; null while his best can't be known: his record hasn't
   *  arrived, or he has no position yet. */
  position: SlotPosition | null;
}

/** His points for one match under `set` at his best position, with no role. `record` is null
 *  while his whole record hasn't arrived, and every figure is then null. */
export function cardPoints(record: MatchStats | null, set: ScoringSet, positions: readonly Position[]): CardPoints {
  const priced = slotsFor(positions).map((cell) => ({ position: positionOfSlot(cell), ...scoreMatch(record, set, cell) }));
  let best: (typeof priced)[number] | undefined;
  for (const each of priced) {
    if (each.total !== null && (best === undefined || each.total > best.total!)) best = each;
  }
  if (best !== undefined) return { scoredAs: "bestPosition", ...best };
  return { scoredAs: "bestPosition", position: null, total: null, categories: set.rules.map((rule) => ({ stat: rule.stat, points: null })) };
}

/** The positions his card can price his base points at (spec/12, The player card: "a switch/toggle"
 *  for "all his main positions", Craig, 31 Oct 2026), back to front as POSITIONS lists them. Only a
 *  slot's position has a price (spec/14): SS has none until how a slot becomes SS is grilled. */
export function cardPositions(positions: readonly Position[]): SlotPosition[] {
  return positions
    .filter((position): position is SlotPosition => (SLOT_POSITIONS as readonly Position[]).includes(position))
    .toSorted((one, other) => positionRank(one) - positionRank(other));
}

/** The cell his points at `position` are priced in: the first in ALL_CELLS whose slot is that
 *  position. Every position's slots lie in one area, and a rule is priced by area and position
 *  alone (priced.ts's priceFor), so every such cell would price him the same. */
export function cellAt(position: SlotPosition): Cell {
  const cell = ALL_CELLS.find((each) => positionOfSlot(each) === position);
  if (cell === undefined) throw new Error(`No cell of the pitch is a ${position} slot`);
  return cell;
}

/** His base points for one match under `set` at `position`: what he did, with no role (SPEC.md,
 *  base points). `record` is null while his whole record hasn't arrived, and every figure is then
 *  null. */
export function pointsAt(record: MatchStats | null, set: ScoringSet, position: SlotPosition): MatchPoints & { position: SlotPosition } {
  return { position, ...scoreMatch(record, set, cellAt(position)) };
}

/** One cell for each slot these positions may stand in: a rule is priced by the slot's area and
 *  position alone (priced.ts's priceFor), so cells alike in both score alike. Slots that are
 *  one of his own positions come first, so a tie names his own: a winger who would score the same
 *  at CAM is best at W. Then back to front. */
function slotsFor(positions: readonly Position[]): Cell[] {
  const seen = new Set<string>();
  const cells: Cell[] = [];
  for (const cell of ALL_CELLS) {
    const key = `${cell.area} ${positionOfSlot(cell)}`;
    if (!playsCell(positions, cell) || seen.has(key)) continue;
    seen.add(key);
    cells.push(cell);
  }
  const own = (cell: Cell) => (positions.includes(positionOfSlot(cell)) ? 0 : 1);
  return cells.toSorted((one, other) => own(one) - own(other));
}
