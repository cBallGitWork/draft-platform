// The most of a shape's cells its players can fill between them, each in a cell he plays: a
// preset's best fit (./reshape.ts `reshaped`) and Quick Pick's count (./quickPick.ts) both
// read it. Pure.

import { cellKey, type Cell } from "../../../convex/lineup/pitch";

/** Each player, in turn, given a cell he plays, the cells most filled between them (augmenting
 *  paths): one placed earlier may move to another cell he plays, never off the pitch, so the
 *  earlier in `players`, the surer of a place. `cellsOf` lists his cells, the one he'd rather first. */
export function matched<Player>(players: readonly Player[], cellsOf: (player: Player) => readonly Cell[]): Map<Player, Cell> {
  const holder = new Map<string, Player>();
  const cellOf = new Map<Player, Cell>();
  const take = (player: Player, cell: Cell) => {
    holder.set(cellKey(cell), player);
    cellOf.set(player, cell);
  };
  const place = (player: Player, seen: Set<string>): boolean => {
    const open = cellsOf(player).find((cell) => !holder.has(cellKey(cell)));
    if (open !== undefined) {
      take(player, open);
      return true;
    }
    return cellsOf(player).some((cell) => {
      const key = cellKey(cell);
      if (seen.has(key)) return false;
      seen.add(key);
      if (!place(holder.get(key)!, seen)) return false;
      take(player, cell);
      return true;
    });
  };
  for (const player of players) place(player, new Set());
  return cellOf;
}
