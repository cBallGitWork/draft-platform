import type { Position } from "../../convex/positions/positionTables";
import { POSITION_NAMES } from "../shared/words";

// A position's code on a square solid chip in its area's colour (plate.md, Marks: position chips):
// the Tactics tab's Selection table, its panels and the formation window. Whole class strings, so
// Tailwind finds them. A slot's chip is the position it stands for; a sweeper is a centre-back's
// role, with no label of its own (spec/05 The pitch).

/** Each area's chip: its fill, and the ink that reads on it. */
const GOALKEEPER = { fill: "bg-area-goalkeeper", ink: "text-ground" };
const DEFENCE = { fill: "bg-area-defence", ink: "text-fact" };
const DEFENSIVE_MIDFIELD = { fill: "bg-area-defensive-midfield", ink: "text-fact" };
const MIDFIELD = { fill: "bg-area-midfield", ink: "text-ground" };
const ATTACKING_MIDFIELD = { fill: "bg-area-attacking-midfield", ink: "text-fact" };
const ATTACK = { fill: "bg-area-attack", ink: "text-ground" };

const CHIP_COLOURS: Record<Position, { fill: string; ink: string }> = {
  GK: GOALKEEPER,
  CB: DEFENCE,
  FB: DEFENCE,
  WB: DEFENCE,
  CDM: DEFENSIVE_MIDFIELD,
  CM: MIDFIELD,
  WM: MIDFIELD,
  CAM: ATTACKING_MIDFIELD,
  W: ATTACKING_MIDFIELD,
  SS: ATTACKING_MIDFIELD,
  ST: ATTACK,
};

/** A chip's fill alone, for a mark in its colour with no code on it (a formation's thumbnail). */
export const chipFillOf = (label: Position) => CHIP_COLOURS[label].fill;
/** A chip's fill and the ink that reads on it, for a chip carrying more than the code (a starter's
 *  chip on the pitch). */
export const chipColoursOf = (label: Position) => CHIP_COLOURS[label];

/** A chip greyed out with its row, such as a player a draft pick can't take (the approved draft
 *  room picture). */
const DIMMED = "opacity-50";

/** One position's chip, named in full on hover and for screen readers; `dimmed` greys it out with
 *  its row. */
export function PositionChip({ label, dimmed = false }: { label: Position; dimmed?: boolean }) {
  const { fill, ink } = CHIP_COLOURS[label];
  return (
    <abbr title={POSITION_NAMES[label]} className={`inline-block min-w-chip px-1 text-center font-bold no-underline ${fill} ${ink}${dimmed ? ` ${DIMMED}` : ""}`}>
      {label}
    </abbr>
  );
}
