// The lineup a manager is setting on the Tactics tab (#14), as each move leaves it: who stands in
// which cell, and the bench in order. Pure, so the screen only says what was asked. Whether it may
// stand is the server's (convex/lineup/lineup.ts), told as each move saves; in ./swaps.ts a player is only
// ever offered a swap in which each plays the cell he lands in (spec/05: "a player fills only slots
// in the areas his positions play") and the league's area limits hold (spec/05, Moving players:
// "Anything that would break the area limits stays unlit"). Presets only: the shape comes from a
// preset, never a player moved into an empty cell (Craig, 1 Nov 2026; #1022).

import { ALL_CELLS, AREAS, byPitchOrder, cellKey, LANES, playsCell, positionOfSlot, sameCell, type Cell } from "../../../convex/lineup/pitch";
import { reconciled, type LineupRules } from "../../../convex/lineup/lineup";
import { matched } from "./matching";
import type { Position } from "../../../convex/positions/positionTables";
import type { OpenTactics } from "../../../convex/lineup/tactics";
import { everyRoleOf, offersRole, roleIn, rolesOfSlot, type Formation, type Role } from "../../../convex/lineup/roles";
import { bestRoleIn, droppedStarter, starsIn } from "../../../convex/stars/bestRole";
import type { InstructionPair, Side } from "../../../convex/lineup/instructions";
import type { RoleStars, Stars } from "../../../convex/stars/starsShape";

export type SquadMember = OpenTactics["squad"][number];
/** A starter, his cell and the role he plays there (roles.ts), none given meaning the slot's first. */
export type Starter = Cell & { playerCode: number; role?: string };

export interface EditedLineup {
  starters: readonly Starter[];
  bench: readonly number[];
  /** The classic picked, by name, until another formation is (spec/05; #991): every move keeps it,
   *  and `formationNameOf` says whether it is custom since. */
  classic?: string;
  /** The team's two instructions (spec/05, Team instructions; #990): every move keeps them, and a
   *  preset picked keeps or switches them (convex/lineup/instructions.ts `keptOrSwitched`). */
  instructions?: InstructionPair;
}

/** Each squad player's stars, which pick the role he starts on when dropped into a slot (spec/05
 *  Roles). */
export type RatingsOf = (playerCode: number) => readonly RoleStars[];

/** A player dropped into `cell` of `formation` (the cells the eleven stand in once he is there), on
 *  the role he has the most stars for there (spec/05 Roles). */
const droppedInto = (playerCode: number, cell: Cell, formation: Formation, ratingsOf: RatingsOf): Starter =>
  droppedStarter(playerCode, cell, formation, ratingsOf(playerCode));

/** The lineup the screen opens on: the one held for the gameweek, its first until the manager
 *  saves one (spec/05), with its instructions in force, on its classic while the league still
 *  holds it, so a classic the league has since dropped or renamed never refuses his next save
 *  (#991). */
export function openingLineup({ lineup, classics, picked }: Pick<OpenTactics, "lineup" | "classics"> & Partial<Pick<OpenTactics, "picked">>): EditedLineup {
  const { classic } = lineup;
  const held = classic !== undefined && classics.some(({ name }) => name === classic);
  return { starters: lineup.starters, bench: lineup.bench, ...(held && { classic }), ...(picked !== undefined && { instructions: picked }) };
}

/** The lineup with one side's instruction picked (spec/05, Team instructions), the other kept. */
export function withInstruction(draft: EditedLineup, inForce: InstructionPair, side: Side, key: string): EditedLineup {
  return { ...draft, instructions: { ...inForce, [side]: key } };
}

/** The lineup the screen shows: the one held, or the manager's edit read against the squad as it
 *  is now by the server's own rule (lineup.ts `reconciled`), so an edit made before a squad change
 *  never names a player the squad no longer holds and stands as the server would read it. */
export function shownLineup(edited: EditedLineup | null, opening: EditedLineup, squadCodes: readonly number[]): EditedLineup {
  return edited === null ? opening : { ...edited, ...reconciled(edited, squadCodes).lineup };
}


/** Who stands in the cell, if anyone. */
export const standingIn = (draft: EditedLineup, cell: Cell) => draft.starters.find((starter) => sameCell(starter, cell));

const without = (draft: EditedLineup, playerCode: number): EditedLineup => ({
  starters: draft.starters.filter((starter) => starter.playerCode !== playerCode),
  bench: draft.bench.filter((code) => code !== playerCode),
});

/** Whether the player is in the eleven. */
export const starts = (draft: EditedLineup, playerCode: number) => draft.starters.some((starter) => starter.playerCode === playerCode);

/** Two players swapped (spec/05, Moving players): starter for starter, each in the other's cell, or
 *  a bench player for a starter, the starter taking his place in the bench order. Each lands on the
 *  role he has the most stars for in his new slot. Two on the bench throws: the bench is put in
 *  order, not swapped. */
export function swapped(draft: EditedLineup, one: number, other: number, ratingsOf: RatingsOf): EditedLineup {
  if (!starts(draft, one) && !starts(draft, other)) throw new Error(`Players ${one} and ${other} are both on the bench: a swap takes a starter`);
  const swap = (playerCode: number) => (playerCode === one ? other : playerCode === other ? one : playerCode);
  return {
    ...draft,
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
export function landingOf(draft: EditedLineup, picked: number, other: number, ratingsOf: RatingsOf): Landing | null {
  const lander = starts(draft, other) ? picked : starts(draft, picked) ? other : null;
  if (lander === null) return null;
  const landed = swapped(draft, picked, other, ratingsOf).starters.find((starter) => starter.playerCode === lander)!;
  const role = roleIn(landed, landed.role);
  return { playerCode: lander, role, stars: starsIn(landed, role.key, ratingsOf(lander)) };
}

/** The starter given a role his slot offers (spec/05 Roles). */
export function withRole(draft: EditedLineup, playerCode: number, role: string): EditedLineup {
  return { ...draft, starters: draft.starters.map((starter) => (starter.playerCode === playerCode ? { ...starter, role } : starter)) };
}

/** The bench player put at `index` in the bench order, 0 being first on (spec/05 Auto-subs: the
 *  manager's bench order). Past either end is that end. A starter throws: he leaves the pitch only
 *  by a swap, so the eleven stay eleven (spec/05; Craig, 4 Nov 2026). */
export function benchedAt(draft: EditedLineup, playerCode: number, index: number): EditedLineup {
  if (starts(draft, playerCode)) throw new Error(`Player ${playerCode} starts: a starter leaves the pitch only by a swap`);
  const rest = without(draft, playerCode);
  const at = Math.max(0, Math.min(index, rest.bench.length));
  return { ...draft, starters: rest.starters, bench: [...rest.bench.slice(0, at), playerCode, ...rest.bench.slice(at)] };
}

/** Back to front, left to right: the order the squad lists the eleven. */
export const startersInOrder = (draft: EditedLineup): Starter[] => draft.starters.toSorted(byPitchOrder);

/** Whether two lineups stand the same: the same players in the same cells, the same bench order,
 *  the same instructions, picked from the same classic or none. */
export function sameLineup(one: EditedLineup, other: EditedLineup): boolean {
  const key = (draft: EditedLineup) =>
    [
      ...startersInOrder(draft).map(({ playerCode, area, lane, role }) => `${playerCode}@${cellKey({ area, lane })}:${role ?? ""}`),
      "bench",
      ...draft.bench,
      "instructions",
      draft.instructions?.attacking ?? "",
      draft.instructions?.defensive ?? "",
    ].join(" ");
  return key(one) === key(other) && one.classic === other.classic;
}

/** The lineup reshaped to a preset's cells (spec/05; Craig, 26 Oct and 1 Nov 2026): each starter,
 *  back to front, moves to a free cell of the shape he plays in his own area, the nearest lane to
 *  his own first. Anyone the shape has no room for there then takes the free cell he plays in the
 *  nearest area, the deeper on a tie; anyone left over goes to the front of the bench, in that
 *  order. Then each bench player, in bench order, takes the first free cell he plays, back to
 *  front (Craig, 1 Nov 2026; #1025); cells still empty are the shape's slots to fill. Only when
 *  that leaves a starter out or a slot empty does it place everyone by best fit instead, taken
 *  where it starts more of the eleven or fills more of the shape (`bestFit`; Craig, 10 Nov 2026,
 *  on #1025). One whose new slot doesn't offer his role starts on his best-star role there (Craig,
 *  1 Nov 2026). */
export function reshaped(draft: EditedLineup, cells: readonly Cell[], rules: Pick<MoveRules, "positionsOf">, ratingsOf: RatingsOf): EditedLineup {
  const first = ownAreaFirst(draft, cells, rules, ratingsOf);
  const kept = (shaped: EditedLineup) => draft.starters.filter(({ playerCode }) => starts(shaped, playerCode)).length;
  if (first.starters.length === cells.length && kept(first) === draft.starters.length) return first;
  const fit = bestFit(draft, cells, rules, ratingsOf);
  return fit.starters.length > first.starters.length || kept(fit) > kept(first) ? fit : first;
}

/** Cells by how near they are to the starter's own: his area first, then the nearest, the deeper of
 *  two as near; in an area, the nearest lane, then left first. */
const byNearness = (starter: Cell) => (one: Cell, other: Cell) => {
  const rows = (cell: Cell) => AREAS.indexOf(cell.area) - AREAS.indexOf(starter.area);
  const lanes = (cell: Cell) => Math.abs(LANES.indexOf(cell.lane) - LANES.indexOf(starter.lane));
  return Math.abs(rows(one)) - Math.abs(rows(other)) || rows(one) - rows(other) || lanes(one) - lanes(other) || LANES.indexOf(one.lane) - LANES.indexOf(other.lane);
};

/** A starter moved into `cell` of `cells`: he keeps the role he plays where the new slot offers it
 *  too, given or his old slot's first, and starts on his best-star role there where it doesn't. */
function movedInto(starter: Starter, cell: Cell, cells: readonly Cell[], ratingsOf: RatingsOf): Starter {
  const playing = roleIn(starter, starter.role).key;
  if (!offersRole(cell, playing, cells)) return droppedInto(starter.playerCode, cell, cells, ratingsOf);
  const role = starter.role ?? (playing === rolesOfSlot(cell, cells)[0].key ? undefined : playing);
  return { playerCode: starter.playerCode, area: cell.area, lane: cell.lane, ...(role !== undefined && { role }) };
}

/** The lineup on a preset's cells by best fit (Craig, 10 Nov 2026; #1025): the most cells filled,
 *  the starters, back to front, surest of a place, each the nearest cell to his own he can have,
 *  then the bench in bench order, each the first free cell he plays, back to front. Anyone left
 *  over goes to the bench, starters first, back to front, then the bench as it was. */
function bestFit(draft: EditedLineup, cells: readonly Cell[], { positionsOf }: Pick<MoveRules, "positionsOf">, ratingsOf: RatingsOf): EditedLineup {
  const plays = (playerCode: number) => cells.filter((cell) => playsCell(positionsOf(playerCode), cell));
  const order = startersInOrder(draft);
  const players = [...order, ...draft.bench.map((playerCode) => ({ playerCode }))];
  const cellOf = matched(players, (player) =>
    "area" in player ? plays(player.playerCode).toSorted(byNearness(player)) : plays(player.playerCode).toSorted(byPitchOrder),
  );
  const starters = players.flatMap((player) => {
    const cell = cellOf.get(player);
    if (cell === undefined) return [];
    return ["area" in player ? movedInto(player, cell, cells, ratingsOf) : droppedInto(player.playerCode, cell, cells, ratingsOf)];
  });
  return { starters, bench: players.filter((player) => !cellOf.has(player)).map(({ playerCode }) => playerCode) };
}

/** Each starter in his own area first, then the nearest he plays, then the bench into what's free. */
function ownAreaFirst(draft: EditedLineup, cells: readonly Cell[], { positionsOf }: Pick<MoveRules, "positionsOf">, ratingsOf: RatingsOf): EditedLineup {
  const free = [...cells];
  const starters: Starter[] = [];
  const nearestFree = (starter: Starter, inHisArea: boolean) =>
    free
      .filter((cell) => (!inHisArea || cell.area === starter.area) && playsCell(positionsOf(starter.playerCode), cell))
      .toSorted(byNearness(starter))[0];
  const moveInto = (starter: Starter, cell: Cell) => {
    free.splice(free.indexOf(cell), 1);
    starters.push(movedInto(starter, cell, cells, ratingsOf));
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
export const presetInUse = <Shape extends { name: string; cells: readonly Cell[] }>(draft: EditedLineup, presets: readonly Shape[]): Shape | undefined =>
  presetOfCells(draft.starters, presets);

/** The league's preset whose shape is these cells, cell for cell, if any. */
export function presetOfCells<Shape extends { name: string; cells: readonly Cell[] }>(cells: readonly Cell[], presets: readonly Shape[]): Shape | undefined {
  const standing = new Set(cells.map(cellKey));
  return presets.find((preset) => preset.cells.length === standing.size && preset.cells.every((cell) => standing.has(cellKey(cell))));
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
export function placeOf(draft: EditedLineup, playerCode: number): { starter: Starter; formation: Formation } | { benchIndex: number; benchLast: number } | null {
  const starter = draft.starters.find((each) => each.playerCode === playerCode);
  if (starter !== undefined) return { starter, formation: draft.starters };
  const benchIndex = draft.bench.indexOf(playerCode);
  return benchIndex === -1 ? null : { benchIndex, benchLast: draft.bench.length - 1 };
}
