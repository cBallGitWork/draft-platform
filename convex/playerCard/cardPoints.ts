// What one of a player's matches is worth on his card (spec/12, The player card; #381): for a
// player in a lineup, the points his team got from his slot; for anyone else, what he would score
// at his best position, labelled so. His best position is the slot his positions let him stand in
// (pitch.ts's playsCell) that scores the most for the match. Pure, so the card's query and its
// tests price alike.

import { AREAS, LANES, playsCell, positionOfSlot, type Cell, type SlotPosition } from "../lineup/pitch";
import type { Position } from "../positions/positionTables";
import { scoreMatch, type MatchPoints, type MatchStats } from "../scoring/scoring";
import type { ScoringSet } from "../scoring/scoringSet";

/** How a match was priced: from his slot in a lineup, or at his best position. */
export type ScoredAs = "slot" | "bestPosition";

export interface CardPoints extends MatchPoints {
  scoredAs: ScoredAs;
  /** The slot's position he was priced at; null while his best can't be known: his record hasn't
   *  arrived, or he has no position yet. */
  position: SlotPosition | null;
}

/** His points for one match under `set`: `slot`'s when he stood in one, else his best position's.
 *  `record` is null while his whole record hasn't arrived, and every figure is then null. */
export function cardPoints(record: MatchStats | null, set: ScoringSet, positions: readonly Position[], slot: Cell | null): CardPoints {
  if (slot !== null) return { scoredAs: "slot", position: positionOfSlot(slot), ...scoreMatch(record, set, slot) };
  const priced = slotsFor(positions).map((cell) => ({ position: positionOfSlot(cell), ...scoreMatch(record, set, cell) }));
  const best = priced.reduce<(typeof priced)[number] | undefined>(
    (most, each) => (each.total !== null && (most === undefined || each.total > most.total!) ? each : most),
    undefined,
  );
  if (best !== undefined) return { scoredAs: "bestPosition", ...best };
  return { scoredAs: "bestPosition", position: null, total: null, categories: set.rules.map((rule) => ({ stat: rule.stat, points: null })) };
}

/** One cell for each slot these positions may stand in: a rule is priced by the slot's area and
 *  position alone (scoringSet.ts's priceFor), so cells alike in both score alike. Slots that are
 *  one of his own positions come first, so a tie names his own: a winger who would score the same
 *  at CAM is best at W. Then back to front. */
function slotsFor(positions: readonly Position[]): Cell[] {
  const seen = new Set<string>();
  const cells: Cell[] = [];
  for (const area of AREAS) {
    for (const lane of LANES) {
      const cell = { area, lane };
      const key = `${area} ${positionOfSlot(cell)}`;
      if (!playsCell(positions, cell) || seen.has(key)) continue;
      seen.add(key);
      cells.push(cell);
    }
  }
  const own = (cell: Cell) => (positions.includes(positionOfSlot(cell)) ? 0 : 1);
  return cells.toSorted((one, other) => own(one) - own(other));
}
