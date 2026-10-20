// The pitch a lineup stands on (spec/05, The pitch; #8), and which of its cells each position plays
// (spec/06, The labels). Both are the product's, the same in every league, so they are constants.
// How many may stand in each area is a league's rule, and lives in ./lineup.ts's arguments.

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

/** The labels have no side: a full back is a full back on either flank. */
export const POSITION_LABELS = ["GK", "CB", "FB", "WB", "CDM", "CM", "WM", "CAM", "W", "SS", "ST"] as const;
export type PositionLabel = (typeof POSITION_LABELS)[number];

/** Each lane of the area, the usual case: anyone who plays an area fills any of its cells. */
const wholeArea = (area: Area): Cell[] => LANES.map((lane) => ({ area, lane }));

const PLAYABLE_CELLS: Record<PositionLabel, readonly Cell[]> = {
  GK: wholeArea("goalkeeper"),
  CB: wholeArea("defence"),
  FB: wholeArea("defence"),
  // There is no wing-back row: a wing back also plays the wide lanes of the two midfield rows.
  WB: [
    ...wholeArea("defence"),
    ...WIDE_LANES.map((lane) => ({ area: "defensiveMidfield" as const, lane })),
    ...WIDE_LANES.map((lane) => ({ area: "midfield" as const, lane })),
  ],
  CDM: wholeArea("defensiveMidfield"),
  CM: wholeArea("midfield"),
  WM: wholeArea("midfield"),
  CAM: wholeArea("attackingMidfield"),
  W: wholeArea("attackingMidfield"),
  SS: [...wholeArea("attackingMidfield"), ...wholeArea("attack")],
  ST: wholeArea("attack"),
};

/** Whether a player with these positions may stand in this cell. Any one of them is enough, and
 *  one still unconfirmed counts the same (spec/06, New signings). */
export function playsCell(positions: readonly PositionLabel[], cell: Cell): boolean {
  return positions.some((position) =>
    PLAYABLE_CELLS[position].some((playable) => playable.area === cell.area && playable.lane === cell.lane),
  );
}
