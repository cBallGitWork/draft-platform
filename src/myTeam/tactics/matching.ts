// The most of a shape's cells its players can fill between them, each in a cell he plays: a
// preset's best fit (./reshape.ts `reshaped`) and Quick Pick's count (./quickPick.ts) both
// read it. The matching itself is convex/shared/matching.ts's. Pure.

import { cellKey, type Cell } from "../../../convex/lineup/pitch";
import { matched } from "../../../convex/shared/matching";

/** Each player, in turn, given a cell he plays, the cells most filled between them: one placed
 *  earlier takes an open cell he plays if there is one, and moves to another only when he must,
 *  never off the pitch, so the earlier in `players`, the surer of a place. `cellsOf` lists his
 *  cells, the one he'd rather first. */
export function matchedCells<Player>(players: readonly Player[], cellsOf: (player: Player) => readonly Cell[]): Map<Player, Cell> {
  return matched(players, cellsOf, cellKey, "openFirst");
}
