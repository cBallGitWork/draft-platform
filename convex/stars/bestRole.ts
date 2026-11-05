// The role a player starts on when dropped into a slot (spec/05 Roles; #11): the one he has the
// most stars for there. Pure and apart from the rating, so the Tactics screen picks as the server
// does without loading the scorer.

import type { Cell } from "../lineup/pitch";
import { rolesOfSlot, type Formation, type Role } from "../lineup/roles";
import type { RoleStars } from "./starsShape";

/** The role among these, the roles of this slot, a player has the most stars for: a tie, or no
 *  stars for any of them ("?" or "—"), goes to the first (Craig, 1 Nov 2026). */
export function bestRoleIn(cell: Cell, roles: readonly Role[], ratings: readonly RoleStars[]): Role {
  let best = roles[0];
  let bestStars = -Infinity;
  for (const role of roles) {
    const stars = ratings.find((each) => each.area === cell.area && each.role === role.key)?.stars;
    if (typeof stars === "number" && stars > bestStars) [best, bestStars] = [role, stars];
  }
  return best;
}

/** The role a player dropped into this slot of this formation (the cells the eleven stand in once
 *  he is there) is saved on: his best-star role's key, or undefined for the slot's first, which a
 *  starter with none given plays (roles.ts's roleIn). Saved when he is dropped, never worked out
 *  when his points are, so a change of stars never changes his points. */
export function droppedRole(cell: Cell, formation: Formation, ratings: readonly RoleStars[]): string | undefined {
  const roles = rolesOfSlot(cell, formation);
  const best = bestRoleIn(cell, roles, ratings);
  return best === roles[0] ? undefined : best.key;
}

/** The starter he is, dropped into this slot of this formation: its cell, and the role droppedRole
 *  saves, if any. */
export function droppedStarter(playerCode: number, { area, lane }: Cell, formation: Formation, ratings: readonly RoleStars[]): Cell & { playerCode: number; role?: string } {
  const role = droppedRole({ area, lane }, formation, ratings);
  return { playerCode, area, lane, ...(role !== undefined && { role }) };
}
