// The lineup a manager is setting on the Tactics tab (#14), as each move leaves it: who stands in
// which cell, and the bench in order. Pure, so the screen only says what was asked. Whether it may
// stand is the server's (convex/lineup/lineup.ts), told as each move saves; here a player is only
// ever offered a cell he plays (spec/05: "a player fills only slots in the areas his positions
// play") and a move that keeps the league's area limits (spec/05, Moving players: "Anything that
// would break the area limits stays unlit").

import { ALL_CELLS, AREAS, byPitchOrder, cellKey, LANES, playsCell, sameCell, type Cell } from "../../../convex/lineup/pitch";
import { namedCodes, reconciled, STARTER_COUNT, type LineupRules } from "../../../convex/lineup/lineup";
import type { Position } from "../../../convex/positions/positionTables";
import type { OpenTactics } from "../../../convex/lineup/tactics";
import { offersRole, roleIn, rolesOfSlot } from "../../../convex/lineup/roles";
import { droppedStarter } from "../../../convex/stars/bestRole";
import type { RoleStars } from "../../../convex/stars/starsShape";

export type SquadMember = OpenTactics["squad"][number];
/** A starter, his cell and the role he plays there (roles.ts), none given meaning the slot's first. */
export type Starter = Cell & { playerCode: number; role?: string };

export interface DraftLineup {
  starters: readonly Starter[];
  bench: readonly number[];
}

/** Each squad player's stars, which pick the role he starts on when dropped into a slot (spec/05
 *  Roles). */
export type RatingsOf = (playerCode: number) => readonly RoleStars[];

/** No stars: for the checks below, which ask only whether a move may stand, never which role he plays. */
const NO_STARS: RatingsOf = () => [];

/** A player dropped into `cell`, on the role he has the most stars for there (spec/05 Roles). */
const droppedInto = (playerCode: number, cell: Cell, ratingsOf: RatingsOf): Starter => droppedStarter(playerCode, cell, ratingsOf(playerCode));

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


/** Who stands in the cell, if anyone. */
export const standingIn = (draft: DraftLineup, cell: Cell) => draft.starters.find((starter) => sameCell(starter, cell));

const without = (draft: DraftLineup, playerCode: number): DraftLineup => ({
  starters: draft.starters.filter((starter) => starter.playerCode !== playerCode),
  bench: draft.bench.filter((code) => code !== playerCode),
});

/** The player moved into a free cell, from another cell or off the bench. A taken cell throws: the
 *  screen offers only free ones. */
export function placed(draft: DraftLineup, playerCode: number, cell: Cell, ratingsOf: RatingsOf): DraftLineup {
  const standing = standingIn(draft, cell);
  if (standing !== undefined && standing.playerCode !== playerCode) {
    throw new Error(`The ${cell.area} ${cell.lane} cell is taken by player ${standing.playerCode}`);
  }
  const rest = without(draft, playerCode);
  // A new slot offers its own roles: he starts on his best-star one (spec/05).
  return { starters: [...rest.starters, droppedInto(playerCode, cell, ratingsOf)], bench: rest.bench };
}

const starts = (draft: DraftLineup, playerCode: number) => draft.starters.some((starter) => starter.playerCode === playerCode);

/** Two players swapped (spec/05, Moving players): starter for starter, each in the other's cell, or
 *  a bench player for a starter, the starter taking his place in the bench order. Each lands on the
 *  role he has the most stars for in his new slot. Two on the bench throws: the bench is put in
 *  order, not swapped. */
export function swapped(draft: DraftLineup, one: number, other: number, ratingsOf: RatingsOf): DraftLineup {
  if (!starts(draft, one) && !starts(draft, other)) throw new Error(`Players ${one} and ${other} are both on the bench: a swap takes a starter`);
  const swap = (playerCode: number) => (playerCode === one ? other : playerCode === other ? one : playerCode);
  return {
    starters: draft.starters.map((starter) =>
      swap(starter.playerCode) === starter.playerCode ? starter : droppedInto(swap(starter.playerCode), starter, ratingsOf),
    ),
    bench: draft.bench.map(swap),
  };
}

/** The player sent to the cell: into it if it is free, swapped with whoever stands in it if not. */
export function movedTo(draft: DraftLineup, playerCode: number, cell: Cell, ratingsOf: RatingsOf): DraftLineup {
  const standing = standingIn(draft, cell);
  return standing === undefined || standing.playerCode === playerCode
    ? placed(draft, playerCode, cell, ratingsOf)
    : swapped(draft, playerCode, standing.playerCode, ratingsOf);
}

/** What a move is judged by: each squad player's positions, and the league's area limits. */
export interface MoveRules extends LineupRules {
  positionsOf(playerCode: number): readonly Position[];
}

/** How far an area's starters fall outside its limits: 0 within them. */
function outsideLimits(draft: DraftLineup, area: Cell["area"], { areaLimits }: LineupRules): number {
  const count = draft.starters.filter((starter) => starter.area === area).length;
  const { minimum, maximum } = areaLimits[area];
  return Math.max(0, minimum - count, count - maximum);
}

/** Whether a move keeps the limits: no area further outside its own than before, and no twelfth
 *  starter. A lineup still being built, below an area's minimum, may still move towards it. */
function keepsLimits(before: DraftLineup, after: DraftLineup, rules: LineupRules): boolean {
  if (after.starters.length > Math.max(STARTER_COUNT, before.starters.length)) return false;
  return AREAS.every((area) => outsideLimits(after, area, rules) <= outsideLimits(before, area, rules));
}

/** Whether the two may swap: one starts, and each plays the cell he lands in. A swap leaves every
 *  cell held as it was, so it never moves an area's count against its limits. */
export function canSwap(draft: DraftLineup, one: number, other: number, { positionsOf }: Pick<MoveRules, "positionsOf">): boolean {
  if (one === other || (!starts(draft, one) && !starts(draft, other))) return false;
  const landed = swapped(draft, one, other, NO_STARS).starters.filter(({ playerCode }) => playerCode === one || playerCode === other);
  return landed.every((starter) => playsCell(positionsOf(starter.playerCode), starter));
}

/** Whether the player may go to the cell: a free one he plays, the limits holding, or one whose
 *  player he may swap with. His own cell is nowhere to go. */
export function canStandIn(draft: DraftLineup, playerCode: number, cell: Cell, rules: MoveRules): boolean {
  const standing = standingIn(draft, cell);
  if (standing !== undefined) return canSwap(draft, playerCode, standing.playerCode, rules);
  return playsCell(rules.positionsOf(playerCode), cell) && keepsLimits(draft, placed(draft, playerCode, cell, NO_STARS), rules);
}

/** Everywhere a picked-up player can go, which lights up (spec/05, Moving players): each cell he
 *  may stand in, free or taken, and each player he may swap with, on the pitch or the bench. */
export interface Reach {
  cells: Cell[];
  players: number[];
}

export function reachOf(draft: DraftLineup, playerCode: number, rules: MoveRules): Reach {
  return {
    cells: ALL_CELLS.filter((cell) => canStandIn(draft, playerCode, cell, rules)),
    players: namedCodes(draft).filter((other) => canSwap(draft, playerCode, other, rules)),
  };
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
export const startersInOrder = (draft: DraftLineup): Starter[] => draft.starters.toSorted(byPitchOrder);

/** Whether two lineups stand the same: the same players in the same cells, the same bench order. */
export function sameLineup(one: DraftLineup, other: DraftLineup): boolean {
  const key = (draft: DraftLineup) =>
    [...startersInOrder(draft).map(({ playerCode, area, lane, role }) => `${playerCode}@${cellKey({ area, lane })}:${role ?? ""}`), "bench", ...draft.bench].join(" ");
  return key(one) === key(other);
}

/** The lineup reshaped to a preset's cells (spec/05; Craig, 26 Oct and 1 Nov 2026): each starter,
 *  back to front, moves to a free cell of the shape he plays in his own area, the nearest lane to
 *  his own first. Anyone the shape has no room for there then takes the free cell he plays in the
 *  nearest area, the deeper on a tie; anyone left over goes to the front of the bench, in that
 *  order. Cells left empty are the shape's slots still to fill. One whose new slot doesn't offer
 *  his role starts on his best-star role there (Craig, 1 Nov 2026). */
export function reshaped(draft: DraftLineup, cells: readonly Cell[], { positionsOf }: Pick<MoveRules, "positionsOf">, ratingsOf: RatingsOf): DraftLineup {
  const free = [...cells];
  const starters: Starter[] = [];
  const nearestFree = (starter: Starter, inHisArea: boolean) => {
    const rows = (cell: Cell) => AREAS.indexOf(cell.area) - AREAS.indexOf(starter.area);
    const lanes = (cell: Cell) => Math.abs(LANES.indexOf(cell.lane) - LANES.indexOf(starter.lane));
    return free
      .filter((cell) => (!inHisArea || cell.area === starter.area) && playsCell(positionsOf(starter.playerCode), cell))
      .toSorted((one, other) =>
        Math.abs(rows(one)) - Math.abs(rows(other)) || rows(one) - rows(other) || lanes(one) - lanes(other) || LANES.indexOf(one.lane) - LANES.indexOf(other.lane))[0];
  };
  const moveInto = (starter: Starter, cell: Cell) => {
    free.splice(free.indexOf(cell), 1);
    // He keeps the role he plays where the new slot offers it too, given or his old slot's first.
    const playing = roleIn(starter, starter.role).key;
    if (!offersRole(cell, playing)) starters.push(droppedInto(starter.playerCode, cell, ratingsOf));
    else {
      const role = starter.role ?? (playing === rolesOfSlot(cell)[0].key ? undefined : playing);
      starters.push({ playerCode: starter.playerCode, area: cell.area, lane: cell.lane, ...(role !== undefined && { role }) });
    }
  };
  // His own area first for everyone, so no one moved across takes a cell its own player needed.
  const unplaced: Starter[] = [];
  for (const starter of startersInOrder(draft)) {
    const cell = nearestFree(starter, true);
    if (cell === undefined) unplaced.push(starter);
    else moveInto(starter, cell);
  }
  const leftOver: number[] = [];
  for (const starter of unplaced) {
    const cell = nearestFree(starter, false);
    if (cell === undefined) leftOver.push(starter.playerCode);
    else moveInto(starter, cell);
  }
  return { starters, bench: [...leftOver, ...draft.bench] };
}
