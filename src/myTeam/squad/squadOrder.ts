// The Squad tab's rows in order (its approved picture, docs/design/approved/team-squad): by
// position group, his main position's place back to front, the eleven first in each group, then by
// squad number, the numberless last, then by name. No group header rows: the position chips group
// the table (plate.md, Tables and panels). Pure, so it is tested alone.

import { positionRank } from "../../../convex/positions/positionTables";
import type { TeamSquad } from "../seam";

type Row = TeamSquad["players"][number];

/** No number sorts after every number a manager can give (1 to 99). */
const NO_NUMBER = Number.POSITIVE_INFINITY;

/** The squad's rows in the table's order; `starting` holds the codes of the eleven. */
export function squadOrder(players: readonly Row[], starting: ReadonlySet<number>): Row[] {
  const group = (row: Row) => positionRank(row.positions[0] ?? null);
  const benched = (row: Row) => (starting.has(row.code) ? 0 : 1);
  const number = (row: Row) => row.number ?? NO_NUMBER;
  return players.toSorted(
    (one, other) => group(one) - group(other) || benched(one) - benched(other) || number(one) - number(other) || one.name.localeCompare(other.name),
  );
}
