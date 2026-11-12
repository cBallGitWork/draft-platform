// The lineup reshaped to a preset's cells (spec/05; Craig, 26 Oct, 1 Nov and 10 Nov 2026; #1025):
// own area first, and best fit where that leaves a starter out or a slot empty. Pure; a preset,
// a classic formation and a saved plan all reshape the pitch through it.

import { AREAS, byPitchOrder, LANES, playsCell, type Cell } from "../../../convex/lineup/pitch";
import { offersRole, roleIn, rolesOfSlot, takesRole } from "../../../convex/lineup/roles";
import { droppedInto, starts, startersInOrder, type EditedLineup, type MoveRules, type PositionsOf, type RatingsOf, type Starter } from "./lineupEdits";
import { matchedCells } from "./matching";

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
 *  too and he may take it (S05.29), given or his old slot's first, and starts on his best-star role
 *  there among those he may take where not. */
function movedInto(starter: Starter, cell: Cell, cells: readonly Cell[], ratingsOf: RatingsOf, positionsOf: PositionsOf): Starter {
  const playing = roleIn(starter, starter.role).key;
  if (!offersRole(cell, playing, cells) || !takesRole(positionsOf(starter.playerCode), playing)) return droppedInto(starter.playerCode, cell, cells, ratingsOf, positionsOf);
  const role = starter.role ?? (playing === rolesOfSlot(cell, cells)[0].key ? undefined : playing);
  return { playerCode: starter.playerCode, area: cell.area, lane: cell.lane, ...(role !== undefined && { role }) };
}

/** The lineup on a preset's cells by best fit (Craig, 10 Nov 2026; #1025): the most cells filled,
 *  the starters, back to front, surest of a place, each the nearest cell to his own he can have,
 *  then the bench in bench order, each the first free cell he plays, back to front. Anyone left
 *  over goes to the bench, starters first, back to front, then the bench as it was. */
function bestFit(draft: EditedLineup, cells: readonly Cell[], { positionsOf }: Pick<MoveRules, "positionsOf">, ratingsOf: RatingsOf): EditedLineup {
  const plays = (playerCode: number) => cells.filter((cell) => playsCell(positionsOf(playerCode), cell));
  const players: { playerCode: number; starter?: Starter }[] = [
    ...startersInOrder(draft).map((starter) => ({ playerCode: starter.playerCode, starter })),
    ...draft.bench.map((playerCode) => ({ playerCode })),
  ];
  const cellOf = matchedCells(players, ({ playerCode, starter }) => plays(playerCode).toSorted(starter === undefined ? byPitchOrder : byNearness(starter)));
  const starters = players.flatMap((player) => {
    const cell = cellOf.get(player);
    if (cell === undefined) return [];
    return [player.starter === undefined ? droppedInto(player.playerCode, cell, cells, ratingsOf, positionsOf) : movedInto(player.starter, cell, cells, ratingsOf, positionsOf)];
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
    starters.push(movedInto(starter, cell, cells, ratingsOf, positionsOf));
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
      starters.push(droppedInto(playerCode, cell, cells, ratingsOf, positionsOf));
    }
  }
  return { starters, bench };
}
