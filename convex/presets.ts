// The eleven presets every league starts with (spec/05, The pitch; #8). A league's presets are
// its own rules, which it can edit (spec/03), so this is only the set it is given: nothing checks
// a lineup against it. Holding a league's copy is #25's.

import type { Area, Cell, Lane } from "./pitch";

export interface Preset {
  /** As managers say it, such as "4-2-3-1". */
  name: string;
  /** One cell per starter, back to front. */
  cells: readonly Cell[];
}

/** One area's cells, in the lanes given. */
const row = (area: Area, ...lanes: Lane[]): Cell[] => lanes.map((lane) => ({ area, lane }));

const KEEPER = row("goalkeeper", "centre");
const BACK_FOUR = row("defence", "left", "leftCentre", "rightCentre", "right");
const BACK_THREE = row("defence", "leftCentre", "centre", "rightCentre");
const BACK_FIVE = row("defence", "left", "leftCentre", "centre", "rightCentre", "right");
const FLAT_FOUR = row("midfield", "left", "leftCentre", "rightCentre", "right");
const CENTRAL_THREE = row("midfield", "leftCentre", "centre", "rightCentre");
const STRIKE_PAIR = row("attack", "leftCentre", "rightCentre");
const LONE_STRIKER = row("attack", "centre");
const NUMBER_TEN = row("attackingMidfield", "centre");
// A winger (W) plays attacking midfield (spec/06), so a front three's wide men stand there.
const FRONT_THREE = [...row("attackingMidfield", "left"), ...LONE_STRIKER, ...row("attackingMidfield", "right")];

const preset = (name: string, ...areas: Cell[][]): Preset => ({ name, cells: [...KEEPER, ...areas.flat()] });

/** In spec/05's order. */
export const DEFAULT_PRESETS: readonly Preset[] = [
  preset("4-4-2", BACK_FOUR, FLAT_FOUR, STRIKE_PAIR),
  preset("4-3-3", BACK_FOUR, CENTRAL_THREE, FRONT_THREE),
  preset("4-2-3-1", BACK_FOUR, row("defensiveMidfield", "leftCentre", "rightCentre"),
    row("attackingMidfield", "left", "centre", "right"), LONE_STRIKER),
  preset("4-1-4-1", BACK_FOUR, row("defensiveMidfield", "centre"), FLAT_FOUR, LONE_STRIKER),
  preset("4-4-1-1", BACK_FOUR, FLAT_FOUR, NUMBER_TEN, LONE_STRIKER),
  preset("4-3-1-2", BACK_FOUR, CENTRAL_THREE, NUMBER_TEN, STRIKE_PAIR),
  // Wing backs stand in the wide lanes of defensive midfield: there is no wing-back row.
  preset("3-5-2", BACK_THREE, row("defensiveMidfield", "left", "right"), CENTRAL_THREE, STRIKE_PAIR),
  preset("3-4-3", BACK_THREE, FLAT_FOUR, FRONT_THREE),
  preset("3-4-1-2", BACK_THREE, FLAT_FOUR, NUMBER_TEN, STRIKE_PAIR),
  preset("5-3-2", BACK_FIVE, CENTRAL_THREE, STRIKE_PAIR),
  preset("5-4-1", BACK_FIVE, FLAT_FOUR, LONE_STRIKER),
];
