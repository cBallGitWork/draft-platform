import type { Position } from "../../convex/positions/positionTables";
import { POSITION_NAMES } from "../shared/words";

// A position's code on a square solid chip in its area's colour (plate.md, Marks: position chips):
// the Tactics tab's Selection table, its panels and the formation window. Whole class strings, so
// Tailwind finds them. A slot's chip is the position it stands for; a sweeper is a centre-back's
// role, with no label of its own (spec/05 The pitch).

/** Each area's chip: its fill, and the ink that reads on it; `text` is the area's colour as words on
 *  a panel where it reads at 4.5:1 there (goalkeeper 11.2, midfield 7.9, attack 7.3:1), null where
 *  it wouldn't (defence 3.5, defensive midfield 2.9, attacking midfield 3.1:1). */
type AreaColours = { fill: string; ink: string; text: string | null };
const GOALKEEPER: AreaColours = { fill: "bg-area-goalkeeper", ink: "text-ground", text: "text-area-goalkeeper" };
const DEFENCE: AreaColours = { fill: "bg-area-defence", ink: "text-fact", text: null };
const DEFENSIVE_MIDFIELD: AreaColours = { fill: "bg-area-defensive-midfield", ink: "text-fact", text: null };
const MIDFIELD: AreaColours = { fill: "bg-area-midfield", ink: "text-ground", text: "text-area-midfield" };
const ATTACKING_MIDFIELD: AreaColours = { fill: "bg-area-attacking-midfield", ink: "text-fact", text: null };
const ATTACK: AreaColours = { fill: "bg-area-attack", ink: "text-ground", text: "text-area-attack" };

const CHIP_COLOURS: Record<Position, AreaColours> = {
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

/** A chip's fill and ink, for a strip in its area's colour with words on it (a matchup tile's). */
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
