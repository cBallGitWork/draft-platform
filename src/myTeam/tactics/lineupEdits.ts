// The lineup a manager is setting on the Tactics tab (#14), as each move leaves it: who stands in
// which cell, and the bench in order. Pure, so the screen only says what was asked. Whether it may
// stand is the server's (convex/lineup/lineup.ts), told as each move saves; in ./swaps.ts a player is only
// ever offered a swap in which each plays the cell he lands in (spec/05: "a player fills only slots
// in the areas his positions play") and the league's area limits hold (spec/05, Moving players:
// "Anything that would break the area limits stays unlit"). Presets only: the shape comes from a
// preset, never a player moved into an empty cell (Craig, 1 Nov 2026; #1022).

import { ALL_CELLS, byPitchOrder, cellKey, positionOfSlot, sameCell, type Cell } from "../../../convex/lineup/pitch";
import { reconciled, type LineupRules } from "../../../convex/lineup/lineup";
import type { Position } from "../../../convex/positions/positionTables";
import type { OpenTactics } from "../../../convex/lineup/tactics";
import { everyRoleOf, roleIn, takesRole, type Formation, type Role } from "../../../convex/lineup/roles";
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

/** Each squad player's positions, which pick the roles he may take (spec/05 `S05.29`). */
export type PositionsOf = (playerCode: number) => readonly Position[];

/** Each player's positions as the squad holds them. */
export const positionsIn =
  (squad: ReadonlyMap<number, Pick<SquadMember, "positions">>): PositionsOf =>
  (playerCode) =>
    squad.get(playerCode)?.positions ?? [];

/** No positions known: every role a slot offers may be taken (roles.ts's takesRole). */
const ANY_ROLE: PositionsOf = () => [];

/** A player dropped into `cell` of `formation` (the cells the eleven stand in once he is there), on
 *  the role he has the most stars for there among those he may take (spec/05 Roles). */
export const droppedInto = (playerCode: number, cell: Cell, formation: Formation, ratingsOf: RatingsOf, positionsOf: PositionsOf): Starter =>
  droppedStarter(playerCode, cell, formation, ratingsOf(playerCode), positionsOf(playerCode));

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
 *  role he has the most stars for in his new slot, among those his positions take. Two on the
 *  bench throws: the bench is put in order, not swapped. */
export function swapped(draft: EditedLineup, one: number, other: number, ratingsOf: RatingsOf, positionsOf: PositionsOf = ANY_ROLE): EditedLineup {
  if (!starts(draft, one) && !starts(draft, other)) throw new Error(`Players ${one} and ${other} are both on the bench: a swap takes a starter`);
  const swap = (playerCode: number) => (playerCode === one ? other : playerCode === other ? one : playerCode);
  return {
    ...draft,
    starters: draft.starters.map((starter) =>
      swap(starter.playerCode) === starter.playerCode ? starter : droppedInto(swap(starter.playerCode), starter, draft.starters, ratingsOf, positionsOf),
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
export function landingOf(draft: EditedLineup, picked: number, other: number, ratingsOf: RatingsOf, positionsOf: PositionsOf = ANY_ROLE): Landing | null {
  const lander = starts(draft, other) ? picked : starts(draft, picked) ? other : null;
  if (lander === null) return null;
  const landed = swapped(draft, picked, other, ratingsOf, positionsOf).starters.find((starter) => starter.playerCode === lander)!;
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
  return cell === undefined ? undefined : { cell, role: bestRoleIn(cell, everyRoleOf(cell).filter(({ key }) => takesRole(positions, key)), stars) };
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
