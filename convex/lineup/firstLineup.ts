// The lineup a team holds before its manager saves one (spec/05, The pitch; #637, #836): "you
// don't save to create, you save to edit". Pure functions; lineups.ts stores what they pick.

import { DEFAULT_PRESETS, type Preset } from "./presets";
import { byPitchOrder, cellKey, playsCell, sameCell, type Cell } from "./pitch";
import { lineupProblems, type LineupRules, type PlayerPositions } from "./lineup";
import { droppedStarter } from "../stars/bestRole";
import type { RoleStars } from "../stars/starsShape";

/** The formation spec/05 gives every first lineup, whatever presets the league has. */
const FIRST_FORMATION = "4-4-2";

const FIRST_CELLS = DEFAULT_PRESETS.find((preset) => preset.name === FIRST_FORMATION)!.cells;

/** A starter as a stored row holds him: his cell, and the role he was given, none meaning the
 *  slot's first. */
type FirstStarter = Cell & { playerCode: number; role?: string };

/** A lineup.ts Lineup whose every cell is on the pitch, as a stored row holds it. */
export interface FirstLineup {
  starters: FirstStarter[];
  bench: number[];
}

/** The league's rules a first lineup reads, in force in its gameweek: its presets, in order, and
 *  each area's limits on the pitch. */
export interface FirstLineupRules extends LineupRules {
  presets: readonly Preset[];
}

/** The squad's first lineup, in the order it was picked (spec/05, The pitch). Each pick goes into
 *  the deepest open 4-4-2 slot he can play, so a later pick never moves an earlier one; with none
 *  open, or no positions yet, or kept there (`keptOnBench`), he goes on the bench in pick order.
 *  If that leaves a slot empty, it is the first of the league's presets the squad fills completely
 *  within its area limits instead. If none does, the 4-4-2 stands with its gap: an empty slot
 *  scores nothing. `rules` is null for a league with no rules yet, which has only the 4-4-2. Until
 *  the draft is built, the order players joined the squad stands in for the order they were picked. */
export function firstLineup(
  pickOrder: readonly number[],
  positions: PlayerPositions,
  rules: FirstLineupRules | null,
  keptOnBench: ReadonlySet<number> = new Set(),
): FirstLineup {
  const fourFourTwo = placedInPickOrder(FIRST_CELLS, pickOrder, positions, keptOnBench, () => true);
  if (fourFourTwo.starters.length === FIRST_CELLS.length || rules === null) return fourFourTwo;
  for (const { cells } of rules.presets) {
    const filled = filledInPickOrder(cells, pickOrder, positions, keptOnBench);
    if (filled !== null && lineupProblems(filled, positions, rules).length === 0) return filled;
  }
  return fourFourTwo;
}

/** Each starter on the role he was dropped in on (spec/05 Roles; Craig, 1 Nov 2026: each pick going
 *  onto the pitch is a drop): one still in the cell `held` has him in keeps the role he had there;
 *  anyone placed anew starts on his best-star role (stars/bestRole.ts). */
export function withDroppedRoles(picked: FirstLineup, ratingsOf: (playerCode: number) => readonly RoleStars[], held: readonly FirstStarter[] = []): FirstLineup {
  const starters = picked.starters.map((starter) => {
    const before = held.find((each) => each.playerCode === starter.playerCode && sameCell(each, starter));
    return before ?? droppedStarter(starter.playerCode, starter, ratingsOf(starter.playerCode));
  });
  return { starters, bench: picked.bench };
}

/** Who stays on the bench when the first lineup is picked again: each benched player who, with his
 *  positions now, could have taken a slot of `held` when he was picked, one empty or held by a
 *  later pick. Only having no positions then put him there, and spec/05 keeps him there until his
 *  manager moves him. A slot held by someone who has since left the squad doesn't count: who was
 *  picked first can't be told, so a benched player may step into it. */
export function keptOnBenchOf(held: FirstLineup, pickOrder: readonly number[], positions: PlayerPositions): Set<number> {
  const shapeCells = held.starters.length < FIRST_CELLS.length ? FIRST_CELLS : held.starters;
  const holderOf = new Map(held.starters.map((starter) => [cellKey(starter), starter.playerCode]));
  const pickedAt = (playerCode: number) => pickOrder.indexOf(playerCode);
  return new Set(
    held.bench.filter((playerCode) => {
      if (pickedAt(playerCode) === -1) return false;
      const playerPositions = positions.get(playerCode) ?? [];
      return shapeCells.some((cell) => {
        if (!playsCell(playerPositions, cell)) return false;
        const holder = holderOf.get(cellKey(cell));
        return holder === undefined || pickedAt(holder) > pickedAt(playerCode);
      });
    }),
  );
}

/** The picks placed in turn, each into the deepest open cell that still lets the later picks fill
 *  every cell, so the shape is filled whenever the squad can fill it; null when it can't. */
function filledInPickOrder(
  cells: readonly Cell[],
  pickOrder: readonly number[],
  positions: PlayerPositions,
  keptOnBench: ReadonlySet<number>,
): FirstLineup | null {
  const playable = pickOrder.filter((playerCode) => !keptOnBench.has(playerCode));
  if (!canFill(cells, playable, positions)) return null;
  const stillFillable = (open: readonly Cell[], laterPicks: readonly number[]) =>
    canFill(open, laterPicks.filter((playerCode) => playable.includes(playerCode)), positions);
  return placedInPickOrder(cells, pickOrder, positions, keptOnBench, stillFillable);
}

/** Each pick in turn into the deepest open cell he plays, back to front then left to right, that
 *  `allows` given the cells still open after it and the picks after him; the rest on the bench in
 *  pick order. Starters are listed in the pitch's order. */
function placedInPickOrder(
  cells: readonly Cell[],
  pickOrder: readonly number[],
  positions: PlayerPositions,
  keptOnBench: ReadonlySet<number>,
  allows: (openAfter: readonly Cell[], laterPicks: readonly number[]) => boolean,
): FirstLineup {
  let open = cells.toSorted(byPitchOrder);
  const starters: FirstLineup["starters"] = [];
  const bench: number[] = [];
  pickOrder.forEach((playerCode, index) => {
    const playerPositions = keptOnBench.has(playerCode) ? [] : (positions.get(playerCode) ?? []);
    const laterPicks = pickOrder.slice(index + 1);
    const cell = open.find((candidate) => playsCell(playerPositions, candidate) && allows(open.filter((other) => other !== candidate), laterPicks));
    if (cell === undefined) {
      bench.push(playerCode);
      return;
    }
    open = open.filter((other) => other !== cell);
    starters.push({ playerCode, area: cell.area, lane: cell.lane });
  });
  return { starters: starters.toSorted(byPitchOrder), bench };
}

/** Whether these players can fill every one of these cells, one player a cell, each in a cell he
 *  plays: a bipartite matching, grown one cell at a time by augmenting paths. */
function canFill(cells: readonly Cell[], players: readonly number[], positions: PlayerPositions): boolean {
  if (cells.length > players.length) return false;
  const cellOf = new Map<number, number>();
  const augment = (cellIndex: number, seen: Set<number>): boolean => {
    for (const playerCode of players) {
      if (seen.has(playerCode) || !playsCell(positions.get(playerCode) ?? [], cells[cellIndex])) continue;
      seen.add(playerCode);
      const taken = cellOf.get(playerCode);
      if (taken === undefined || augment(taken, seen)) {
        cellOf.set(playerCode, cellIndex);
        return true;
      }
    }
    return false;
  };
  return cells.every((_, cellIndex) => augment(cellIndex, new Set()));
}
