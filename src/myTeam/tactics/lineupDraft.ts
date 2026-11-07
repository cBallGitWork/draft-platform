// The lineup a manager is setting on the Tactics tab (#14), as each move leaves it: who stands in
// which cell, and the bench in order. Pure, so the screen only says what was asked. Whether it may
// stand is the server's (convex/lineup/lineup.ts), told as each move saves; here a player is only
// ever offered a swap in which each plays the cell he lands in (spec/05: "a player fills only slots
// in the areas his positions play") and the league's area limits hold (spec/05, Moving players:
// "Anything that would break the area limits stays unlit"). Presets only: the shape comes from a
// preset, never a player moved into an empty cell (Craig, 1 Nov 2026; #1022).

import { ALL_CELLS, AREAS, byPitchOrder, cellKey, LANES, playsCell, positionOfSlot, sameCell, type Cell } from "../../../convex/lineup/pitch";
import { namedCodes, reconciled, type LineupRules } from "../../../convex/lineup/lineup";
import type { Position } from "../../../convex/positions/positionTables";
import type { OpenTactics } from "../../../convex/lineup/tactics";
import { everyRoleOf, offersRole, roleIn, rolesOfSlot, type Formation, type Role } from "../../../convex/lineup/roles";
import { bestRoleIn, droppedStarter, starsIn } from "../../../convex/stars/bestRole";
import type { RoleStars, Stars } from "../../../convex/stars/starsShape";

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

/** A player dropped into `cell` of `formation` (the cells the eleven stand in once he is there), on
 *  the role he has the most stars for there (spec/05 Roles). */
const droppedInto = (playerCode: number, cell: Cell, formation: Formation, ratingsOf: RatingsOf): Starter =>
  droppedStarter(playerCode, cell, formation, ratingsOf(playerCode));

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
      swap(starter.playerCode) === starter.playerCode ? starter : droppedInto(swap(starter.playerCode), starter, draft.starters, ratingsOf),
    ),
    bench: draft.bench.map(swap),
  };
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

/** Whether a move keeps the limits: no area further outside its own than before. A swap leaves
 *  every cell held as it was, so it never should; the check stays so that one never can (#1022). */
function keepsLimits(before: DraftLineup, after: DraftLineup, rules: LineupRules): boolean {
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

const isKeeper = (positions: readonly Position[]) => positions.includes("GK");

/** Why the two may not swap, null where they may: each plays the cell he lands in, and the limits
 *  hold. Two on the bench, or a player and himself, are no swap: the screen never asks. */
export function swapRefusal(draft: DraftLineup, one: number, other: number, rules: MoveRules): MoveRefusal | null {
  const after = swapped(draft, one, other, NO_STARS);
  for (const starter of after.starters.filter(({ playerCode }) => playerCode === one || playerCode === other)) {
    const positions = rules.positionsOf(starter.playerCode);
    if (playsCell(positions, starter)) continue;
    if (starter.area === "goalkeeper" || isKeeper(positions)) return { kind: "goal" };
    return { kind: "doesNotPlay", playerCode: starter.playerCode, cell: { area: starter.area, lane: starter.lane } };
  }
  return keepsLimits(draft, after, rules) ? null : { kind: "areaLimits" };
}

/** Whether the two may swap (spec/05, Moving players): one starts, and the swap isn't refused. */
export function canSwap(draft: DraftLineup, one: number, other: number, rules: MoveRules): boolean {
  if (one === other || (!starts(draft, one) && !starts(draft, other))) return false;
  return swapRefusal(draft, one, other, rules) === null;
}

/** Where a dragged player lands: a cell of the pitch, a player's row, or the bench's plate. */
export type DropTarget = { cell: Cell } | { playerCode: number } | "bench";

/** Who a drop swaps the player picked up with, or why it is refused (spec/05; Craig, 1 and 4 Nov
 *  2026): an empty cell takes nobody, and a starter leaves the pitch only by a swap, so the bench's
 *  plate takes nobody either. A bench player dropped along the bench is put in order (benchedAt),
 *  never asked here. */
export function dropOutcome(draft: DraftLineup, playerCode: number, target: DropTarget, rules: MoveRules): { swapWith: number } | { refusal: MoveRefusal } {
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

export function reachOf(draft: DraftLineup, playerCode: number, rules: MoveRules): Reach {
  return { players: namedCodes(draft).filter((other) => canSwap(draft, playerCode, other, rules)) };
}

/** Who comes onto the pitch in a swap, the role he lands on there and his stars for it. */
export interface Landing {
  playerCode: number;
  role: Role;
  stars: Stars;
}

/** The swap of the player picked up with `other` as its lit player shows it (spec/05, Moving
 *  players: "with his stars there"; Craig, 7 Nov 2026, #11): the picked-up player in a lit
 *  starter's slot, or a lit bench player in the picked-up starter's, on the role he has the most
 *  stars for there. Null where neither comes onto the pitch in another's slot (two on the bench). */
export function landingOf(draft: DraftLineup, picked: number, other: number, ratingsOf: RatingsOf): Landing | null {
  const lander = starts(draft, other) ? picked : starts(draft, picked) ? other : null;
  if (lander === null) return null;
  const landed = swapped(draft, picked, other, ratingsOf).starters.find((starter) => starter.playerCode === lander)!;
  const role = roleIn(landed, landed.role);
  return { playerCode: lander, role, stars: starsIn(landed, role.key, ratingsOf(lander)) };
}

/** The starter given a role his slot offers (spec/05 Roles). */
export function withRole(draft: DraftLineup, playerCode: number, role: string): DraftLineup {
  return { ...draft, starters: draft.starters.map((starter) => (starter.playerCode === playerCode ? { ...starter, role } : starter)) };
}

/** The bench player put at `index` in the bench order, 0 being first on (spec/05 Auto-subs: the
 *  manager's bench order). Past either end is that end. A starter throws: he leaves the pitch only
 *  by a swap, so the eleven stay eleven (spec/05; Craig, 4 Nov 2026). */
export function benchedAt(draft: DraftLineup, playerCode: number, index: number): DraftLineup {
  if (starts(draft, playerCode)) throw new Error(`Player ${playerCode} starts: a starter leaves the pitch only by a swap`);
  const rest = without(draft, playerCode);
  const at = Math.max(0, Math.min(index, rest.bench.length));
  return { starters: rest.starters, bench: [...rest.bench.slice(0, at), playerCode, ...rest.bench.slice(at)] };
}

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
 *  order. Then each bench player, in bench order, takes the first free cell he plays, back to
 *  front (Craig, 1 Nov 2026; #1025); cells still empty are the shape's slots to fill. One whose
 *  new slot doesn't offer his role starts on his best-star role there (Craig, 1 Nov 2026). */
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
    if (!offersRole(cell, playing, cells)) starters.push(droppedInto(starter.playerCode, cell, cells, ratingsOf));
    else {
      const role = starter.role ?? (playing === rolesOfSlot(cell, cells)[0].key ? undefined : playing);
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
  const bench: number[] = [];
  for (const playerCode of [...leftOver, ...draft.bench]) {
    const cell = free.toSorted(byPitchOrder).find((each) => playsCell(positionsOf(playerCode), each));
    if (cell === undefined) bench.push(playerCode);
    else {
      free.splice(free.indexOf(cell), 1);
      starters.push(droppedInto(playerCode, cell, cells, ratingsOf));
    }
  }
  return { starters, bench };
}

/** The league's preset whose shape the eleven stand in now, cell for cell, if any: its key is the
 *  one pressed in the Formation keys, and its name heads the pitch. */
export function presetInUse<Shape extends { name: string; cells: readonly Cell[] }>(draft: DraftLineup, presets: readonly Shape[]): Shape | undefined {
  const standing = new Set(draft.starters.map(cellKey));
  return presets.find(({ cells }) => cells.length === standing.size && cells.every((cell) => standing.has(cellKey(cell))));
}

/** The slot a position stands for, the first cell of the pitch whose slot it is: a bench player's
 *  best role is read there. A support striker (SS) has no slot of his own (pitch.ts). */
const cellOfPosition = (position: Position): Cell | undefined => ALL_CELLS.find((cell) => positionOfSlot(cell) === position);

/** A bench player's best role (the Selection table's Best role): the one he has the most stars for
 *  in the slot of his first position that has one, his main position's (spec/12; spec/05 Roles),
 *  among every role it holds, as he stands in no formation. Undefined for a player with no position
 *  that has a slot. */
export function benchBestRole({ positions, stars }: Pick<SquadMember, "positions" | "stars">) {
  const cell = positions.map(cellOfPosition).find((each) => each !== undefined);
  return cell === undefined ? undefined : { cell, role: bestRoleIn(cell, everyRoleOf(cell), stars) };
}

/** Where a player stands in the lineup, for his panel: his slot and the cells the eleven stand in
 *  (which pick the roles it offers), or his place on the bench and how long it is; null for one in
 *  neither (gone from the squad since he was tapped). */
export function placeOf(draft: DraftLineup, playerCode: number): { starter: Starter; formation: Formation } | { benchIndex: number; benchLast: number } | null {
  const starter = draft.starters.find((each) => each.playerCode === playerCode);
  if (starter !== undefined) return { starter, formation: draft.starters };
  const benchIndex = draft.bench.indexOf(playerCode);
  return benchIndex === -1 ? null : { benchIndex, benchLast: draft.bench.length - 1 };
}
