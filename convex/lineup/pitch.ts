// The pitch a lineup stands on (spec/05, The pitch; #8), and which of its cells each position plays
// (spec/06, The labels). Both are the product's, the same in every league, so they are constants.
// How many may stand in each area is a league's rule, and lives in ./lineup.ts's arguments.

import type { Position } from "../positions/positionTables";

/** Back to front. */
export const AREAS = [
  "goalkeeper",
  "defence",
  "defensiveMidfield",
  "midfield",
  "attackingMidfield",
  "attack",
] as const;
export type Area = (typeof AREAS)[number];

/** Left to right, across every area, the goalkeeper's included. */
export const LANES = ["left", "leftCentre", "centre", "rightCentre", "right"] as const;
export type Lane = (typeof LANES)[number];

/** One player stands in a cell. */
export interface Cell {
  area: Area;
  lane: Lane;
}

const WIDE_LANES: readonly Lane[] = ["left", "right"];

/** The area's cells in these lanes. */
export const cellsOf = (area: Area, lanes: readonly Lane[]): Cell[] => lanes.map((lane) => ({ area, lane }));

/** Every cell of the pitch, back to front, then left to right. */
export const ALL_CELLS: readonly Cell[] = AREAS.flatMap((area) => cellsOf(area, LANES));

/** A cell as one string, for a set or a map of cells, and to name it in a message. */
export const cellKey = ({ area, lane }: Cell): string => `${area}/${lane}`;

/** Whether two cells, or two placements, name the same area and lane. */
export const sameCell = (one: { area: string; lane: string }, other: { area: string; lane: string }): boolean =>
  one.area === other.area && one.lane === other.lane;

/** The pitch's order for a sort, ALL_CELLS's: back to front, then left to right. */
export const byPitchOrder = (one: Cell, other: Cell): number =>
  AREAS.indexOf(one.area) - AREAS.indexOf(other.area) || LANES.indexOf(one.lane) - LANES.indexOf(other.lane);

/** Whether a cell held as data names one of the pitch's areas and one of its lanes. */
export const isOnPitch = ({ area, lane }: Cell): boolean => AREAS.includes(area) && LANES.includes(lane);

/** The usual case: anyone who plays an area fills any of its cells. */
const wholeArea = (area: Area): Cell[] => cellsOf(area, LANES);

const PLAYABLE_CELLS: Record<Position, readonly Cell[]> = {
  GK: wholeArea("goalkeeper"),
  CB: wholeArea("defence"),
  FB: wholeArea("defence"),
  // There is no wing-back row: a wing back also plays the wide lanes of the two midfield rows.
  WB: [
    ...wholeArea("defence"),
    ...cellsOf("defensiveMidfield", WIDE_LANES),
    ...cellsOf("midfield", WIDE_LANES),
  ],
  CDM: wholeArea("defensiveMidfield"),
  CM: wholeArea("midfield"),
  WM: wholeArea("midfield"),
  CAM: wholeArea("attackingMidfield"),
  W: wholeArea("attackingMidfield"),
  SS: [...wholeArea("attackingMidfield"), ...wholeArea("attack")],
  ST: wholeArea("attack"),
};

/** The positions a slot can be, back to front: every label but SS, who has no slot of his own
 *  (shadow striker is a role, spec/05). */
export const SLOT_POSITIONS = ["GK", "FB", "CB", "WB", "CDM", "WM", "CM", "W", "CAM", "ST"] as const satisfies readonly Position[];
export type SlotPosition = (typeof SLOT_POSITIONS)[number];

/** Each area's position in its wide lanes and in its centre lanes (spec/14, How a rule scores). */
const SLOT_POSITION_BY_AREA: Record<Area, { wide: SlotPosition; centre: SlotPosition }> = {
  goalkeeper: { wide: "GK", centre: "GK" },
  defence: { wide: "FB", centre: "CB" },
  defensiveMidfield: { wide: "WB", centre: "CDM" },
  midfield: { wide: "WM", centre: "CM" },
  attackingMidfield: { wide: "W", centre: "CAM" },
  attack: { wide: "ST", centre: "ST" },
};

/** The position of the slot at this cell, left and right alike: what a rule priced by position
 *  prices (spec/14). */
export function positionOfSlot({ area, lane }: Cell): SlotPosition {
  return SLOT_POSITION_BY_AREA[area][WIDE_LANES.includes(lane) ? "wide" : "centre"];
}

/** The areas a player with these positions plays any cell of, back to front: a wing back's are
 *  defence and both midfield rows his wide lanes reach. */
export function areasOf(positions: readonly Position[]): Area[] {
  return AREAS.filter((area) => positions.some((position) => PLAYABLE_CELLS[position].some((cell) => cell.area === area)));
}

/** Whether a player with these positions may stand in this cell. Any one of them is enough, and
 *  one still unconfirmed counts the same (spec/06, New signings). */
export function playsCell(positions: readonly Position[], cell: Cell): boolean {
  return positions.some((position) =>
    PLAYABLE_CELLS[position].some((playable) => sameCell(playable, cell)),
  );
}
