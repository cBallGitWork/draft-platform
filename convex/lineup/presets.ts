// The twenty-one presets every league starts with (spec/05, The pitch; #8). A league's presets are
// its own rules, which it can edit (spec/03), so this is only the set it is given: nothing checks
// a lineup against it. A league's copy is held with its rules (#25, leagueRules.ts).

import { cellsOf, LANES, sameCell, type Area, type Cell, type Lane } from "./pitch";

export interface Preset {
  /** As managers say it, such as "4-2-3-1". */
  name: string;
  /** One cell per starter, back to front. */
  cells: readonly Cell[];
}

const row = (area: Area, ...lanes: Lane[]): Cell[] => cellsOf(area, lanes);

const KEEPER = row("goalkeeper", "centre");
const BACK_FOUR = row("defence", "left", "leftCentre", "rightCentre", "right");
const BACK_THREE = row("defence", "leftCentre", "centre", "rightCentre");
const BACK_FIVE = row("defence", "left", "leftCentre", "centre", "rightCentre", "right");
const FLAT_FOUR = row("midfield", "left", "leftCentre", "rightCentre", "right");
const CENTRAL_THREE = row("midfield", "leftCentre", "centre", "rightCentre");
const STRIKE_PAIR = row("attack", "leftCentre", "rightCentre");
const LONE_STRIKER = row("attack", "centre");
const NUMBER_TEN = row("attackingMidfield", "centre");
const HOLDING_PAIR = row("defensiveMidfield", "leftCentre", "rightCentre");
const ANCHOR = row("defensiveMidfield", "centre");
const CENTRAL_PAIR = row("midfield", "leftCentre", "rightCentre");
const WIDE_PAIR = row("attackingMidfield", "left", "right");
const INSIDE_PAIR = row("attackingMidfield", "leftCentre", "rightCentre");
// A winger (W) plays attacking midfield (spec/06), so a front three's wide men stand there.
const FRONT_THREE = [...WIDE_PAIR, ...LONE_STRIKER];

/** Each preset gets cells of its own: a league edits its copy (spec/03), and a cell shared with
 *  another preset would change that one too. */
const preset = (name: string, ...areas: Cell[][]): Preset => ({
  name,
  cells: [...KEEPER, ...areas.flat()].map((cell) => ({ ...cell })),
});

/** In spec/05's order. */
export const DEFAULT_PRESETS: readonly Preset[] = [
  preset("4-4-2", BACK_FOUR, FLAT_FOUR, STRIKE_PAIR),
  preset("4-3-3", BACK_FOUR, CENTRAL_THREE, FRONT_THREE),
  preset("4-2-3-1", BACK_FOUR, HOLDING_PAIR,
    row("attackingMidfield", "left", "centre", "right"), LONE_STRIKER),
  preset("4-1-4-1", BACK_FOUR, ANCHOR, FLAT_FOUR, LONE_STRIKER),
  preset("4-4-1-1", BACK_FOUR, FLAT_FOUR, NUMBER_TEN, LONE_STRIKER),
  preset("4-3-1-2", BACK_FOUR, CENTRAL_THREE, NUMBER_TEN, STRIKE_PAIR),
  // Its wing backs stand in defensive midfield's wide lanes.
  preset("3-5-2", BACK_THREE, row("defensiveMidfield", "left", "right"), CENTRAL_THREE, STRIKE_PAIR),
  preset("3-4-3", BACK_THREE, FLAT_FOUR, FRONT_THREE),
  preset("3-4-1-2", BACK_THREE, FLAT_FOUR, NUMBER_TEN, STRIKE_PAIR),
  preset("5-3-2", BACK_FIVE, CENTRAL_THREE, STRIKE_PAIR),
  preset("5-4-1", BACK_FIVE, FLAT_FOUR, LONE_STRIKER),
  // The ten Craig added (28 Oct 2026).
  preset("4-5-1", BACK_FOUR, row("midfield", ...LANES), LONE_STRIKER),
  // The box: two holding, two wide ahead of them.
  preset("4-2-2-2", BACK_FOUR, HOLDING_PAIR, WIDE_PAIR, STRIKE_PAIR),
  // The narrow diamond.
  preset("4-1-2-1-2", BACK_FOUR, ANCHOR, CENTRAL_PAIR, NUMBER_TEN, STRIKE_PAIR),
  // The Christmas tree: its two behind the striker stand inside.
  preset("4-3-2-1", BACK_FOUR, CENTRAL_THREE, INSIDE_PAIR, LONE_STRIKER),
  preset("4-1-3-2", BACK_FOUR, ANCHOR, row("midfield", "left", "centre", "right"), STRIKE_PAIR),
  preset("4-2-4", BACK_FOUR, CENTRAL_PAIR, WIDE_PAIR, STRIKE_PAIR),
  preset("3-4-2-1", BACK_THREE, FLAT_FOUR, INSIDE_PAIR, LONE_STRIKER),
  preset("3-1-4-2", BACK_THREE, ANCHOR, FLAT_FOUR, STRIKE_PAIR),
  preset("5-2-3", BACK_FIVE, CENTRAL_PAIR, FRONT_THREE),
  preset("5-3-1-1", BACK_FIVE, CENTRAL_THREE, NUMBER_TEN, LONE_STRIKER),
];

/** The name of the preset a side stands in: the first of `presets` whose cells are exactly these,
 *  in any order; null for a shape none of them is, one its manager has edited off a preset
 *  (spec/10: "preset until its edited, then we name it"; #878). `presets` are the league's in force
 *  then (spec/03), never this file's. */
export function presetNameOf(cells: readonly Cell[], presets: readonly Preset[]): string | null {
  const preset = presets.find((each) => each.cells.length === cells.length && each.cells.every((cell) => cells.some((other) => sameCell(cell, other))));
  return preset?.name ?? null;
}
