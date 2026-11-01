import type { Position } from "../../convex/positions/positionTables";
import type { SlotLabel } from "../../convex/lineup/roles";
import { POSITION_NAMES, sweeperName } from "../shared/words";

// A position's code on a square solid chip in its area's colour (plate.md, Marks: position chips):
// the Tactics tab's Selection table, its panels and the formation window. Whole class strings, so
// Tailwind finds them.

/** What a chip can say: a player's position, or a slot's label (SW for a sweeper). */
export type ChipLabel = Position | SlotLabel;

/** Each area's chip: its fill, and the ink that reads on it. */
const GOALKEEPER = { fill: "bg-area-goalkeeper", ink: "text-ground" };
const DEFENCE = { fill: "bg-area-defence", ink: "text-fact" };
const DEFENSIVE_MIDFIELD = { fill: "bg-area-defensive-midfield", ink: "text-fact" };
const MIDFIELD = { fill: "bg-area-midfield", ink: "text-ground" };
const ATTACKING_MIDFIELD = { fill: "bg-area-attacking-midfield", ink: "text-fact" };
const ATTACK = { fill: "bg-area-attack", ink: "text-ground" };

const CHIP_COLOURS: Record<ChipLabel, { fill: string; ink: string }> = {
  GK: GOALKEEPER,
  CB: DEFENCE,
  FB: DEFENCE,
  WB: DEFENCE,
  SW: DEFENCE,
  CDM: DEFENSIVE_MIDFIELD,
  CM: MIDFIELD,
  WM: MIDFIELD,
  CAM: ATTACKING_MIDFIELD,
  W: ATTACKING_MIDFIELD,
  SS: ATTACKING_MIDFIELD,
  ST: ATTACK,
};

/** A chip's fill alone, for a mark in its colour with no code on it (a formation's thumbnail). */
export const chipFillOf = (label: ChipLabel) => CHIP_COLOURS[label].fill;

const chipName = (label: ChipLabel) => (label === "SW" ? sweeperName : POSITION_NAMES[label]);

/** One position's chip, named in full on hover and for screen readers. */
export function PositionChip({ label }: { label: ChipLabel }) {
  const { fill, ink } = CHIP_COLOURS[label];
  return (
    <abbr title={chipName(label)} className={`inline-block min-w-chip px-1 text-center font-bold no-underline ${fill} ${ink}`}>
      {label}
    </abbr>
  );
}
