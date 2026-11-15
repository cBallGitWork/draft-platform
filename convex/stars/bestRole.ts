// The role a player starts on when dropped into a slot (spec/05 Roles; #11): the one he has the
// most stars for there. Pure and apart from the rating, so the Tactics screen picks as the server
// does without loading the scorer.

import type { Cell } from "../lineup/pitch";
import type { PlayerPositions } from "../lineup/lineup";
import { isRole, rolesFor, rolesOfSlot, type Formation, type Role } from "../lineup/roles";
import type { Position } from "../positions/positionTables";
import { NO_DATA, type RoleStars, type Stars } from "./starsShape";

/** His stars for a role in a cell's area: "—" where he holds no rating for it. */
export function starsIn(cell: Cell, role: string, ratings: readonly RoleStars[]): Stars {
  return ratings.find((each) => each.area === cell.area && each.role === role)?.stars ?? NO_DATA;
}

/** The role among these, the roles of this slot, a player has the most stars for: a tie, or no
 *  stars for any of them ("?" or "—"), goes to the first (Craig, 1 Nov 2026). */
export function bestRoleIn(cell: Cell, roles: readonly Role[], ratings: readonly RoleStars[]): Role {
  let best = roles[0];
  let bestStars = -Infinity;
  for (const role of roles) {
    const stars = starsIn(cell, role.key, ratings);
    if (typeof stars === "number" && stars > bestStars) [best, bestStars] = [role, stars];
  }
  return best;
}

/** The role a player with these positions dropped into this slot of this formation (the cells the
 *  eleven stand in once he is there) is saved on: his best-star role among those he may take
 *  (roles.ts's rolesFor), its key, or undefined for the slot's first, which a starter with none
 *  given plays (roles.ts's roleIn). Saved when he is dropped, never worked out when his points are,
 *  so a change of stars never changes his points. */
export function droppedRole(cell: Cell, formation: Formation, ratings: readonly RoleStars[], positions: readonly Position[]): string | undefined {
  const best = bestRoleIn(cell, rolesFor(cell, formation, positions), ratings);
  return best === rolesOfSlot(cell, formation)[0] ? undefined : best.key;
}

/** The starter he is, dropped into this slot of this formation: its cell, and the role droppedRole
 *  saves, if any. */
export function droppedStarter(
  playerCode: number,
  { area, lane }: Cell,
  formation: Formation,
  ratings: readonly RoleStars[],
  positions: readonly Position[],
): Cell & { playerCode: number; role?: string } {
  const role = droppedRole({ area, lane }, formation, ratings, positions);
  return { playerCode, area, lane, ...(role !== undefined && { role }) };
}

type Starter = Cell & { playerCode: number; role?: string };

/** Whether the starter holds a role no slot offers: one removed from the set (spec/05 `S05.51`). */
export const onCutRole = ({ role }: { role?: string }): boolean => role !== undefined && !isRole(role);

/** The starters, each on a removed role dropped into his slot again in their formation, so he moves
 *  to the role he'd get dropped into it on and his lineup is never refused (spec/05 `S05.51`); the
 *  rest as they were. */
export function withCutRolesDropped(
  starters: readonly Starter[],
  positions: PlayerPositions,
  ratingsOf: (playerCode: number) => readonly RoleStars[],
): Starter[] {
  return starters.map((starter) =>
    onCutRole(starter) ? droppedStarter(starter.playerCode, starter, starters, ratingsOf(starter.playerCode), positions.get(starter.playerCode) ?? []) : starter,
  );
}
