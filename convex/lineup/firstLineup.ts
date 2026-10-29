// The lineup a team holds before its manager saves one (spec/05, The pitch; #637): "you don't save
// to create, you save to edit". One pure function; lineups.ts stores what it picks.

import { DEFAULT_PRESETS } from "./presets";
import { playsCell, type Cell } from "./pitch";
import type { PlayerPositions } from "./lineup";

/** The formation spec/05 gives every first lineup, whatever presets the league has. */
export const FIRST_FORMATION = "4-4-2";

const FIRST_CELLS = DEFAULT_PRESETS.find((preset) => preset.name === FIRST_FORMATION)!.cells;

/** A lineup.ts Lineup whose every cell is on the pitch, as a stored row holds it. */
export interface FirstLineup {
  starters: (Cell & { playerCode: number })[];
  bench: number[];
}

/** The 4-4-2, back to front, each slot filled by the first player picked who plays it, and the rest
 *  on the bench in the order they were picked. A slot nobody left can play stays empty (spec/05:
 *  there is no rule about gaps), and a player with no positions yet sits on the bench. Until the
 *  draft is built, the order players joined the squad stands in for the order they were picked. */
export function firstLineup(pickOrder: readonly number[], positions: PlayerPositions): FirstLineup {
  const unplaced = [...pickOrder];
  const starters: FirstLineup["starters"] = [];
  for (const cell of FIRST_CELLS) {
    const index = unplaced.findIndex((playerCode) => playsCell(positions.get(playerCode) ?? [], cell));
    if (index === -1) continue;
    const [playerCode] = unplaced.splice(index, 1);
    starters.push({ playerCode, area: cell.area, lane: cell.lane });
  }
  return { starters, bench: unplaced };
}
