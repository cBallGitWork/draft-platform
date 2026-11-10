// Quick Pick (spec/05, Moving players; #849): the current shape filled with the best eleven by stars.
// Pure, beside ./lineupEdits.ts, whose moves it makes; the save judges it as any other move.
// Craig's answers of 6 Nov 2026 on #849: an out player is never picked while a fit one can stand in
// that slot, and a doubtful one is picked on his stars; "?" and "—" rank below any starred player;
// a tie keeps whoever is already starting, then goes by bench order.

import { byPitchOrder, playsCell, sameCell, type Cell } from "../../../convex/lineup/pitch";
import { rolesFor } from "../../../convex/lineup/roles";
import { bestRoleIn, droppedStarter, starsIn } from "../../../convex/stars/bestRole";
import type { EditedLineup, SquadMember, Starter } from "./lineupEdits";
import { matched } from "./matching";

/** What Quick Pick reads of each squad player. */
export type PickedFrom = Pick<SquadMember, "playerCode" | "positions" | "stars" | "availability" | "unheld">;

/** Out, so picked only where no fit player can stand: one the football sync doesn't hold is too,
 *  as nothing says he can play. */
const isOut = ({ availability, unheld }: PickedFrom) => unheld || availability === "out";

/** His stars in the cell, on the role he has the most for there; "?" and "—" below any star. */
function starsThere(member: PickedFrom, cell: Cell, shape: readonly Cell[]): number {
  const stars = starsIn(cell, bestRoleIn(cell, rolesFor(cell, shape, member.positions), member.stars).key, member.stars);
  return typeof stars === "number" ? stars : -1;
}

/** The most slots the players can fill between them, each in a cell he plays. */
const mostFilled = (cells: readonly Cell[], players: readonly PickedFrom[]): number =>
  matched(players, (player) => cells.filter((cell) => playsCell(player.positions, cell))).size;

/** The lineup with the shape's cells filled by the best eleven by stars (spec/05): the best player
 *  and slot first, each pick only where the slots left can still all be filled, each landing on his
 *  best-star role there. A starter kept in his own cell keeps his role. Starters left out go to the
 *  front of the bench, back to front, then the bench as it was. The classic and instructions stay,
 *  as the shape does. */
export function quickPick(draft: EditedLineup, shape: readonly Cell[], squad: readonly PickedFrom[]): EditedLineup {
  const benchIndex = (playerCode: number) => draft.bench.indexOf(playerCode);
  const startingIn = (cell: Cell) => draft.starters.find((starter) => sameCell(starter, cell));
  const starting = new Set(draft.starters.map(({ playerCode }) => playerCode));
  // A tie keeps whoever is already starting, his own cell first, then goes by bench order.
  const keeps = (member: PickedFrom, cell: Cell) =>
    startingIn(cell)?.playerCode === member.playerCode ? -1 : starting.has(member.playerCode) ? 0 : 1 + benchIndex(member.playerCode);
  const named = squad.filter(({ playerCode }) => starting.has(playerCode) || benchIndex(playerCode) !== -1);

  let cells = shape.toSorted(byPitchOrder);
  let players = named;
  const picked: Starter[] = [];
  let toFill = mostFilled(cells, players);
  while (toFill > 0) {
    const pairs = cells
      .flatMap((cell) => players.filter((member) => playsCell(member.positions, cell)).map((member) => ({ cell, member })))
      .toSorted(
        (one, other) =>
          Number(isOut(one.member)) - Number(isOut(other.member)) ||
          starsThere(other.member, other.cell, shape) - starsThere(one.member, one.cell, shape) ||
          keeps(one.member, one.cell) - keeps(other.member, other.cell) ||
          byPitchOrder(one.cell, other.cell),
      );
    const { cell, member } = pairs.find(({ cell, member }) =>
      mostFilled(cells.filter((each) => each !== cell), players.filter((each) => each !== member)) === toFill - 1,
    )!;
    const held = startingIn(cell);
    picked.push(held?.playerCode === member.playerCode ? held : droppedStarter(member.playerCode, cell, shape, member.stars, member.positions));
    cells = cells.filter((each) => each !== cell);
    players = players.filter((each) => each !== member);
    toFill -= 1;
  }
  const inEleven = new Set(picked.map(({ playerCode }) => playerCode));
  const leftOut = draft.starters.toSorted(byPitchOrder).map(({ playerCode }) => playerCode).filter((code) => !inEleven.has(code));
  return { ...draft, starters: picked, bench: [...leftOut, ...draft.bench.filter((code) => !inEleven.has(code))] };
}
