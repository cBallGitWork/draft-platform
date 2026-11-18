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
function firstBackLineFor(cells: readonly Cell[]): BackLineScoring | null {
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
export const FIRST_PRESETS: readonly Preset[] = [
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

/** Each preset's description, by name, for the formation window (spec/05 S05.61: Claude drafts each
 *  from the formation's real history, Craig's edits win). Read by name, never held in a league's
 *  copy, so an edit here reaches every league; a preset a league named itself has none. */
const PRESET_DESCRIPTIONS = new Map<string, string>([
  ["4-4-2", "English football's standard through the 80s and 90s: two banks of four behind a strike pair."],
  ["4-3-3", "Michels' Ajax made it famous: three in midfield, wingers wide of a centre-forward."],
  ["4-2-3-1", "The 2000s' favourite: two holding midfielders shield the back four, three play behind one striker."],
  ["4-1-4-1", "An anchor screens the back four with a flat four ahead; many a 4-3-3 drops into it without the ball."],
  ["4-4-1-1", "A 4-4-2 with the second striker dropped into the hole, the role Cantona and Bergkamp made their own."],
  ["4-3-1-2", "Three central midfielders and a ten behind two strikers: Lippi's Juventus, with Zidane at the tip."],
  ["3-5-2", "Three centre-backs and wing backs on the flanks: Bilardo's Argentina won the 1986 World Cup with it."],
  ["3-4-3", "Three at the back, a flat four and a front three: Conte's Chelsea won the 2016-17 league with it."],
  ["3-4-1-2", "Three at the back, a flat four and a ten feeding two strikers, a Serie A staple around 2000."],
  ["5-3-2", "Wing backs drop in to make a back five, three hold the middle and two strikers wait for the break."],
  ["5-4-1", "Five at the back, four across midfield and one striker: the deepest block here, the underdog's shape."],
  ["4-5-1", "Five across midfield and one striker, the away side's way to win the middle and stay hard to beat."],
  ["4-2-2-2", "The box: two holding and two attacking midfielders behind two strikers, Brazil's shape in the 80s."],
  ["4-1-2-1-2", "The narrow diamond: an anchor, a ten and two strikers; Ancelotti's Milan won Europe with it in 2003."],
  ["4-3-2-1", "The Christmas tree: three in midfield and two inside behind one striker, Venables' England at Euro 96."],
  ["4-1-3-2", "An anchor behind a midfield three and two strikers: a strike pair kept without giving up the middle."],
  ["4-2-4", "Brazil's 1958 World Cup shape: two in midfield, two wingers and two strikers."],
  ["3-4-2-1", "Three at the back, two inside behind one striker: Tuchel's Chelsea won Europe with it in 2021."],
  ["3-1-4-2", "Three centre-backs and an anchor stay home while a flat four and two strikers go forward."],
  ["5-2-3", "Five at the back but three up front: wing backs give the width and two hold the middle."],
  ["5-3-1-1", "Five at the back, three in midfield and a ten behind the striker: a deep block with a link up front."],
  ["3-6-1", "A 3-5-2 with a ten behind one striker: six in midfield to win the ball and feed the front man."],
  ["2-3-5", "The pyramid: two backs, three half-backs and five forwards, football's standard shape until the 1920s."],
  ["2-3-2-3", "Il Metodo: Pozzo's Italy dropped the pyramid's inside forwards and won the 1934 and 1938 World Cups."],
]);

/** A preset's description by its name (spec/05 S05.61); undefined for a name the site doesn't list. */
export const presetDescriptionOf = (name: string): string | undefined => PRESET_DESCRIPTIONS.get(name);

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
