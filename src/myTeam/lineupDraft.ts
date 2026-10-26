// The lineup a manager is setting on the Tactics tab (#14), before it is saved: who stands in which
// cell, and the bench in order. Pure, so the screen only says what was asked. Whether it may stand
// is the server's (convex/lineup/lineup.ts), told when it is saved; here a player is only ever put
// in a free cell he plays (spec/05: "a player fills only slots in the areas his positions play").

import { AREAS, LANES, playsCell, type Cell } from "../../convex/lineup/pitch";
import type { Position } from "../../convex/positions/positionTables";
import type { OpenTactics } from "../../convex/lineup/tactics";

export type SquadMember = OpenTactics["squad"][number];
export type Starter = Cell & { playerCode: number };

export interface DraftLineup {
  starters: readonly Starter[];
  bench: readonly number[];
}

/** The lineup the screen opens on: the one held for the gameweek, or, for a team that has never
 *  saved one, the whole squad on the bench in the order it joined. */
export function openingLineup({ lineup, squad }: Pick<OpenTactics, "lineup" | "squad">): DraftLineup {
  if (lineup.kind === "none") return { starters: [], bench: squad.map(({ playerCode }) => playerCode) };
  return { starters: lineup.starters, bench: lineup.bench };
}

/** The lineup against the squad as it is now, as the server reads a saved one (lineups.ts): who has
 *  left drops out, and who has joined goes to the end of the bench, so an edit made before either
 *  never names a player the squad no longer holds. */
export function withSquad(draft: DraftLineup, squadCodes: readonly number[]): DraftLineup {
  const inSquad = new Set(squadCodes);
  const named = new Set([...draft.starters.map(({ playerCode }) => playerCode), ...draft.bench]);
  return {
    starters: draft.starters.filter(({ playerCode }) => inSquad.has(playerCode)),
    bench: [...draft.bench.filter((playerCode) => inSquad.has(playerCode)), ...squadCodes.filter((playerCode) => !named.has(playerCode))],
  };
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
  return { starters: [...rest.starters, { playerCode, ...cell }], bench: rest.bench };
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
    [...startersInOrder(draft).map(({ playerCode, area, lane }) => `${playerCode}@${area}/${lane}`), "bench", ...draft.bench].join(" ");
  return key(one) === key(other);
}
