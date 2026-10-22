// When a player's positions change (spec/06, When positions change): gradually, as his real-life
// role does. A run of his newest starts somewhere that doesn't give a position he holds from his
// starts flags it, and a longer run takes it away. Only positions from starts: one the admin set
// stays until he removes it, and a label is not a start. Pure: the same starts always give the
// same changes.

import { placePosition, type Position } from "./positionTables";
import type { Start } from "./positions";

/** The admin's thresholds: how many of his newest starts in a row elsewhere flag a position, and
 *  how many take it away. */
export interface ChangeThresholds {
  flagAfter: number;
  removeAfter: number;
}

/** Spec/06's starting point, until the admin tunes them. */
export const FIRST_THRESHOLDS: ChangeThresholds = { flagAfter: 3, removeAfter: 6 };

/** How many of his newest starts in a row were at a place that doesn't give `position`, judging
 *  only those that kicked off before `judgedBefore` (null judges all): positions change only
 *  between gameweeks (docs/positions.md). A start that gives no position (a sheet that drew none, or
 *  a formation the table doesn't know) says nothing of where he played, so neither adds to the run
 *  nor ends it. */
export function startsElsewhere(starts: readonly Start[], position: Position, judgedBefore: number | null): number {
  const judged = starts.filter((start) => judgedBefore === null || start.kickoff < judgedBefore).sort((a, b) => b.kickoff - a.kickoff);
  let run = 0;
  for (const { formation, line, place } of judged) {
    const played = formation === null || line === null || place === null ? null : placePosition(formation, line, place);
    if (played === position) break;
    if (played !== null) run += 1;
  }
  return run;
}
