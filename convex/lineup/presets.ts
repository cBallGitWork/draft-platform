// The presets every league starts with (spec/05, The pitch; #8). A league's presets are
// its own rules, which it can edit (spec/03), so this is only the set it is given: nothing checks
// a lineup against it. A league's copy is held with its rules (#25, leagueRules.ts).

import { firstPairFor, type InstructionPair } from "./instructions";
import { backOf, cellsOf, LANES, sameShape, TWO_AT_THE_BACK_COUNT, type Area, type Cell, type Lane } from "./pitch";

export interface Preset {
  /** As managers say it, such as "4-2-3-1". */
  name: string;
  /** One cell per starter, back to front. */
  cells: readonly Cell[];
  /** Its default attacking and defensive instruction (spec/05, Team instructions; #990): absent
   *  only from presets a league held before #990, which read instructions.ts's first defaults. */
  instructions?: InstructionPair;
  /** What its keeper and defence slots score for a clean sheet and each goal conceded, in place of
   *  the site's set (spec/05: two at the back's "clean sheets is 3, every goal conceded -1"); null
   *  for none. Absent only from presets a league held before #990, which read `backLineOf`'s first
   *  values. */
  backLine?: BackLineScoring | null;
}

/** A formation's own values for its back line (spec/05, Team instructions; Craig, 9 Nov 2026, on
 *  #990: it replaces the base values for the keeper and defence slots, the clean sheet keeping its
 *  60-minute minimum, and shows on his clean sheet and goals conceded lines). */
export interface BackLineScoring {
  /** Points for a clean sheet. */
  cleanSheet: number;
  /** Points for each goal conceded. */
  goalConceded: number;
}

/** Two at the back's first values (Craig, 4 Nov 2026: "clean sheets is 3, every goal conceded -1"). */
export const TWO_AT_THE_BACK: BackLineScoring = { cleanSheet: 3, goalConceded: -1 };

/** The first back line a shape gets: two at the back's, for a defence row of two; else none. */
export function firstBackLineFor(cells: readonly Cell[]): BackLineScoring | null {
  return backOf(cells) === TWO_AT_THE_BACK_COUNT ? { ...TWO_AT_THE_BACK } : null;
}

/** The back line of the preset a side stands in: its own, or for one held before #990 the first
 *  for its shape; null for a shape no preset is. `presets` are the league's in force then. */
export function backLineOf(cells: readonly Cell[], presets: readonly Preset[]): BackLineScoring | null {
  const preset = presetOf(cells, presets);
  if (preset === undefined) return null;
  return preset.backLine === undefined ? firstBackLineFor(preset.cells) : preset.backLine;
}

const row = (area: Area, ...lanes: Lane[]): Cell[] => cellsOf(area, lanes);

const KEEPER = row("goalkeeper", "centre");
const BACK_FOUR = row("defence", "left", "leftCentre", "rightCentre", "right");
// Not roles.ts's BACK_THREE, the number of centre-backs a back-three role needs.
const THREE_CENTRE_BACKS = row("defence", "leftCentre", "centre", "rightCentre");
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
const BACK_TWO = row("defence", "leftCentre", "rightCentre");

/** Each preset gets cells of its own: a league edits its copy (spec/03), and a cell shared with
 *  another preset would change that one too. */
const preset = (name: string, ...areas: Cell[][]): Preset => {
  const cells = [...KEEPER, ...areas.flat()].map((cell) => ({ ...cell }));
  return { name, cells, instructions: firstPairFor(cells), backLine: firstBackLineFor(cells) };
};

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
  preset("3-5-2", THREE_CENTRE_BACKS, row("defensiveMidfield", "left", "right"), CENTRAL_THREE, STRIKE_PAIR),
  preset("3-4-3", THREE_CENTRE_BACKS, FLAT_FOUR, FRONT_THREE),
  preset("3-4-1-2", THREE_CENTRE_BACKS, FLAT_FOUR, NUMBER_TEN, STRIKE_PAIR),
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
  preset("3-4-2-1", THREE_CENTRE_BACKS, FLAT_FOUR, INSIDE_PAIR, LONE_STRIKER),
  preset("3-1-4-2", THREE_CENTRE_BACKS, ANCHOR, FLAT_FOUR, STRIKE_PAIR),
  preset("5-2-3", BACK_FIVE, CENTRAL_PAIR, FRONT_THREE),
  preset("5-3-1-1", BACK_FIVE, CENTRAL_THREE, NUMBER_TEN, LONE_STRIKER),
  // 3-5-2 with a ten behind the striker (Craig, 1 Nov 2026: "also add 3-6-1"; placed 5 Nov 2026).
  preset("3-6-1", THREE_CENTRE_BACKS, row("defensiveMidfield", "left", "right"), CENTRAL_THREE, NUMBER_TEN, LONE_STRIKER),
  // Two at the back, as Craig asked (1 Nov 2026) and placed (4 Nov 2026). Sweeper and libero are
  // centre-back roles, never presets (Craig, 5 Nov 2026).
  preset("2-3-5", BACK_TWO, CENTRAL_THREE, row("attack", ...LANES)),
  preset("2-3-2-3", BACK_TWO, CENTRAL_THREE, INSIDE_PAIR, row("attack", "leftCentre", "centre", "rightCentre")),
];

/** The name of the preset a side stands in: the first of `presets` whose cells are exactly these,
 *  in any order; null for a shape none of them is, one its manager has edited off a preset
 *  (spec/10: "preset until its edited, then we name it"; #878). `presets` are the league's in force
 *  then (spec/03), never this file's. */
export function presetNameOf(cells: readonly Cell[], presets: readonly Preset[]): string | null {
  return presetOf(cells, presets)?.name ?? null;
}

/** The first of `presets` whose cells are exactly these, in any order. */
function presetOf(cells: readonly Cell[], presets: readonly Preset[]): Preset | undefined {
  return presets.find((each) => sameShape(each.cells, cells));
}
