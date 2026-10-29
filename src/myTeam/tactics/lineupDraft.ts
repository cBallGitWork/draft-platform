// The lineup a manager is setting on the Tactics tab (#14), before it is saved: who stands in which
// cell, and the bench in order. Pure, so the screen only says what was asked. Whether it may stand
// is the server's (convex/lineup/lineup.ts), told when it is saved; here a player is only ever put
// in a free cell he plays (spec/05: "a player fills only slots in the areas his positions play").

import { AREAS, cellKey, LANES, playsCell, type Cell } from "../../../convex/lineup/pitch";
import { reconciled } from "../../../convex/lineup/lineup";
import type { Position } from "../../../convex/positions/positionTables";
import type { OpenTactics } from "../../../convex/lineup/tactics";
import { offersRole } from "../../../convex/lineup/roles";

export type SquadMember = OpenTactics["squad"][number];
/** A starter, his cell and the role he plays there (roles.ts), none given meaning the slot's first. */
export type Starter = Cell & { playerCode: number; role?: string };

export interface DraftLineup {
  starters: readonly Starter[];
  bench: readonly number[];
}

/** The lineup the screen opens on: the one held for the gameweek, its first until the manager
 *  saves one (spec/05). */
export function openingLineup({ lineup }: Pick<OpenTactics, "lineup">): DraftLineup {
  return { starters: lineup.starters, bench: lineup.bench };
}

/** The lineup the screen shows: the one held, or the manager's edit read against the squad as it
 *  is now by the server's own rule (lineup.ts `reconciled`), so an edit made before a squad change
 *  never names a player the squad no longer holds and stands as the server would read it. */
export function shownLineup(edited: DraftLineup | null, opening: DraftLineup, squadCodes: readonly number[]): DraftLineup {
  return edited === null ? opening : reconciled(edited, squadCodes).lineup;
}

const sameCell = (one: Cell, other: Cell) => one.area === other.area && one.lane === other.lane;

/** Who stands in the cell, if anyone. */
export const standingIn = (draft: DraftLineup, cell: Cell) => draft.starters.find((starter) => sameCell(starter, cell));

/** Whether the player may be put in the cell: it is free and he plays it. */
export const canStandIn = (draft: DraftLineup, positions: readonly Position[], cell: Cell) =>
  standingIn(draft, cell) === undefined && playsCell(positions, cell);

const without = (draft: DraftLineup, playerCode: number): DraftLineup => ({
  starters: draft.starters.filter((starter) => starter.playerCode !== playerCode),
  bench: draft.bench.filter((code) => code !== playerCode),
});

/** The player moved into a free cell, from another cell or off the bench. A taken cell throws: the
 *  screen offers only free ones. */
export function placed(draft: DraftLineup, playerCode: number, cell: Cell): DraftLineup {
  const standing = standingIn(draft, cell);
  if (standing !== undefined && standing.playerCode !== playerCode) {
    throw new Error(`The ${cell.area} ${cell.lane} cell is taken by player ${standing.playerCode}`);
  }
  const rest = without(draft, playerCode);
  // A new slot offers its own roles: he starts on its first (spec/05).
  return { starters: [...rest.starters, { playerCode, ...cell }], bench: rest.bench };
}

/** The starter given a role his slot offers (spec/05 Roles). */
export function withRole(draft: DraftLineup, playerCode: number, role: string): DraftLineup {
  return { ...draft, starters: draft.starters.map((starter) => (starter.playerCode === playerCode ? { ...starter, role } : starter)) };
}

/** The player put on the bench at `index`, 0 being first on, from the pitch or from elsewhere on
 *  the bench (spec/05 Auto-subs: the manager's bench order). Past either end is that end. */
export function benchedAt(draft: DraftLineup, playerCode: number, index: number): DraftLineup {
  const rest = without(draft, playerCode);
  const at = Math.max(0, Math.min(index, rest.bench.length));
  return { starters: rest.starters, bench: [...rest.bench.slice(0, at), playerCode, ...rest.bench.slice(at)] };
}

/** The starter taken off the pitch, to the end of the bench. */
export const benched = (draft: DraftLineup, playerCode: number): DraftLineup => benchedAt(draft, playerCode, Infinity);

/** Back to front, left to right: the order the squad lists the eleven. */
const cellOrder = ({ area, lane }: Cell) => AREAS.indexOf(area) * LANES.length + LANES.indexOf(lane);
export const startersInOrder = (draft: DraftLineup): Starter[] => draft.starters.toSorted((one, other) => cellOrder(one) - cellOrder(other));

/** Whether two lineups stand the same: the same players in the same cells, the same bench order. */
export function sameLineup(one: DraftLineup, other: DraftLineup): boolean {
  const key = (draft: DraftLineup) =>
    [...startersInOrder(draft).map(({ playerCode, area, lane, role }) => `${playerCode}@${cellKey({ area, lane })}:${role ?? ""}`), "bench", ...draft.bench].join(" ");
  return key(one) === key(other);
}

/** The lineup reshaped to a preset's cells (spec/05; Craig, 26 Oct 2026): each starter, back to
 *  front, moves to a free cell of the shape in his own area, the nearest lane to his own first;
 *  anyone left over goes to the front of the bench, in that order. Cells left empty are the
 *  shape's slots still to fill. */
export function reshaped(draft: DraftLineup, cells: readonly Cell[]): DraftLineup {
  const free = [...cells];
  const starters: Starter[] = [];
  const leftOver: number[] = [];
  for (const starter of startersInOrder(draft)) {
    const distance = (cell: Cell) => Math.abs(LANES.indexOf(cell.lane) - LANES.indexOf(starter.lane));
    const nearest = free
      .filter((cell) => cell.area === starter.area)
      .toSorted((one, other) => distance(one) - distance(other) || LANES.indexOf(one.lane) - LANES.indexOf(other.lane))[0];
    if (nearest === undefined) {
      leftOver.push(starter.playerCode);
      continue;
    }
    free.splice(free.indexOf(nearest), 1);
    // He keeps his role where the new slot offers it too.
    const kept = starter.role !== undefined && offersRole(nearest, starter.role);
    starters.push({ playerCode: starter.playerCode, area: nearest.area, lane: nearest.lane, ...(kept && { role: starter.role }) });
  }
  return { starters, bench: [...leftOver, ...draft.bench] };
}
