// Team instructions (spec/05, Team instructions; #990): one attacking and one defensive a team, each
// offered only where its formation's shape allows it. The set, each instruction's description, the
// shape it needs and each preset's default pair are a league's rules (spec/03), so every function
// here takes them as arguments; FIRST_INSTRUCTIONS is only the set a league is given. What a shape
// "allows" is Craig's answers on #990 (6 Nov 2026): only the defence row counts as the back, a
// winger stands wide in attacking midfield or attack, wide means both flanks filled above the
// defence, and Press high's three are counted one row at a time. Pure: the server's save and the
// Tactics screen both read it, so the two never differ. Scoring an instruction is not here.

import { AREAS, sameCell, type Area, type Cell, type Lane } from "./pitch";

export const SIDES = ["attacking", "defensive"] as const;
export type Side = (typeof SIDES)[number];

/** What a shape must have for an instruction to be offered (spec/05's "needs" column). */
export const SHAPE_NEEDS = [
  "anyShape",
  /** Exactly one in attack, and nobody wide in attacking midfield or attack. */
  "oneUpTopNoWingers",
  /** Someone in the left lane and someone in the right lane of a row above the defence. */
  "wideOnBothFlanks",
  "twoAtTheBack",
  /** Three or more in one row of midfield, attacking midfield or attack. */
  "threeInARow",
  "backThreeOrFour",
  "fiveAtTheBack",
] as const;
export type ShapeNeed = (typeof SHAPE_NEEDS)[number];

export interface Instruction {
  /** Stable, as a lineup stores it. */
  key: string;
  side: Side;
  /** As managers say it, such as "Park the bus". */
  name: string;
  /** What it rewards and costs, as the screen shows it. */
  description: string;
  needs: ShapeNeed;
}

/** A team's two picks, by key. */
export type InstructionPair = Record<Side, string>;

/** The set every league starts with, in spec/05's order. The descriptions are Claude's draft, for
 *  Craig to edit (spec/05: "Claude drafts them and Craig edits them"). */
export const FIRST_INSTRUCTIONS: readonly Instruction[] = [
  { key: "playOutFromTheBack", side: "attacking", name: "Play out from the back", needs: "anyShape",
    description: "Rewards the keeper's and defenders' passing; costs errors leading to a shot or goal." },
  { key: "bootItToTheBigMan", side: "attacking", name: "Boot it to the big man", needs: "oneUpTopNoWingers",
    description: "Rewards headed goals and the forwards' aerials won; costs the back line's failed long balls." },
  { key: "getItWide", side: "attacking", name: "Get it wide", needs: "wideOnBothFlanks",
    description: "Rewards crosses; costs failed crosses." },
  { key: "shootOnSight", side: "attacking", name: "Shoot on sight", needs: "anyShape",
    description: "Rewards goals and shots on target from outside the box; costs long shots off target or blocked." },
  { key: "gungHo", side: "attacking", name: "Gung-ho", needs: "twoAtTheBack",
    description: "Rewards goals and assists; costs goals conceded." },
  { key: "pressHigh", side: "defensive", name: "Press high", needs: "threeInARow",
    description: "Rewards possession won high and in midfield; costs fouls." },
  { key: "holdAHighLine", side: "defensive", name: "Hold a high line", needs: "backThreeOrFour",
    description: "Rewards defenders' offsides won and interceptions; costs goals conceded." },
  { key: "clearIt", side: "defensive", name: "Clear it", needs: "anyShape",
    description: "Rewards defenders' clearances and blocks; costs defenders losing the ball." },
  { key: "getStuckIn", side: "defensive", name: "Get stuck in", needs: "anyShape",
    description: "Rewards tackles and duels won; costs cards and fouls." },
  { key: "keepItTightEarly", side: "defensive", name: "Keep it tight early", needs: "anyShape",
    description: "Rewards a clean sheet at half-time; costs goals let in before half-time." },
  { key: "parkTheBus", side: "defensive", name: "Park the bus", needs: "fiveAtTheBack",
    description: "Rewards the keeper's and defenders' clean sheets; costs goals and assists." },
];

/** An instruction's name as managers say it, by its key; the key itself for one not in the set. */
export const instructionName = (key: string): string => FIRST_INSTRUCTIONS.find((each) => each.key === key)?.name ?? key;

/** The first defaults (Craig, 6 Nov 2026, on #990): five at the back starts on Park the bus, two
 *  at the back on Gung-ho, and every other shape on Play out from the back and Keep it tight early.
 *  A league's presets hold their own pair (presets.ts), which it edits. */
export function firstPairFor(cells: readonly Cell[]): InstructionPair {
  const back = inArea(cells, "defence").length;
  return {
    attacking: back === 2 ? "gungHo" : "playOutFromTheBack",
    defensive: back === 5 ? "parkTheBus" : "keepItTightEarly",
  };
}

const inArea = (cells: readonly Cell[], area: Area) => cells.filter((cell) => cell.area === area);
const WIDE: readonly Lane[] = ["left", "right"];
const ABOVE_DEFENCE: readonly Area[] = AREAS.slice(AREAS.indexOf("defensiveMidfield"));
const PRESSING_ROWS: readonly Area[] = ["midfield", "attackingMidfield", "attack"];
const WINGER_ROWS: readonly Area[] = ["attackingMidfield", "attack"];

/** Whether a formation, the cells its eleven stand in, has what an instruction needs. */
export function shapeAllows(needs: ShapeNeed, cells: readonly Cell[]): boolean {
  const back = inArea(cells, "defence").length;
  switch (needs) {
    case "anyShape":
      return true;
    case "oneUpTopNoWingers":
      return inArea(cells, "attack").length === 1 && !cells.some((cell) => WINGER_ROWS.includes(cell.area) && WIDE.includes(cell.lane));
    case "wideOnBothFlanks": {
      const above = cells.filter((cell) => ABOVE_DEFENCE.includes(cell.area));
      return WIDE.every((lane) => above.some((cell) => cell.lane === lane));
    }
    case "twoAtTheBack":
      return back === 2;
    case "threeInARow":
      return PRESSING_ROWS.some((area) => inArea(cells, area).length >= 3);
    case "backThreeOrFour":
      return back === 3 || back === 4;
    case "fiveAtTheBack":
      return back === 5;
  }
}

/** The side's instructions this formation offers, in the league's order. A shape none of them fits
 *  is offered the whole side, so a team never stands with nothing to pick; the league's presets'
 *  own shapes never are (leagueRulesCheck.ts holds each one's default to it). */
export function offeredOn(side: Side, cells: readonly Cell[], set: readonly Instruction[]): Instruction[] {
  const onSide = set.filter((instruction) => instruction.side === side);
  const offered = onSide.filter(({ needs }) => shapeAllows(needs, cells));
  return offered.length > 0 ? offered : onSide;
}

/** A preset as this module reads it: its cells and, once the league holds it, its default pair. */
export interface PresetDefaults {
  cells: readonly Cell[];
  instructions?: InstructionPair;
}

const sameShape = (one: readonly Cell[], other: readonly Cell[]) => one.length === other.length && one.every((cell) => other.some((each) => sameCell(each, cell)));

/** The formation's default pair: the league's preset of this shape's own, each where it is still
 *  offered; else, for a preset saved before #990 or a shape that is no preset, the first defaults'
 *  where offered; else the side's first offered. */
export function defaultPairOf(cells: readonly Cell[], presets: readonly PresetDefaults[], set: readonly Instruction[]): InstructionPair {
  const held = presets.find((preset) => sameShape(preset.cells, cells))?.instructions;
  const first = firstPairFor(cells);
  const pick = (side: Side) => {
    const offered = offeredOn(side, cells, set);
    return [held?.[side], first[side]].find((key) => offered.some((each) => each.key === key)) ?? offered[0].key;
  };
  return { attacking: pick("attacking"), defensive: pick("defensive") };
}

/** One pick a formation change switched (spec/05: "the line under the toolbar says so"). */
export interface Switched {
  side: Side;
  from: Instruction;
  to: Instruction;
}

/** The pair a formation keeps on a change of shape: each pick the new shape offers stays, and one
 *  it blocks switches to the new formation's default for that side. A pick missing, or no longer
 *  in the league's set, takes the default with no word said. */
export function keptOrSwitched(
  picked: Partial<InstructionPair> | undefined,
  cells: readonly Cell[],
  presets: readonly PresetDefaults[],
  set: readonly Instruction[],
): { pair: InstructionPair; switched: Switched[] } {
  const fallback = defaultPairOf(cells, presets, set);
  const switched: Switched[] = [];
  const keep = (side: Side): string => {
    const from = set.find((each) => each.key === picked?.[side] && each.side === side);
    if (from === undefined) return fallback[side];
    if (offeredOn(side, cells, set).includes(from)) return from.key;
    switched.push({ side, from, to: set.find((each) => each.key === fallback[side])! });
    return fallback[side];
  };
  return { pair: { attacking: keep("attacking"), defensive: keep("defensive") }, switched };
}

/** Why a sent pair can't stand on these cells, null where it can: each names an instruction of its
 *  side in the league's set that the shape offers. */
export function pairRefusal(pair: InstructionPair, cells: readonly Cell[], set: readonly Instruction[]): { side: Side; key: string; blockedBy?: ShapeNeed } | null {
  for (const side of SIDES) {
    const key = pair[side];
    const instruction = set.find((each) => each.key === key && each.side === side);
    if (instruction === undefined) return { side, key };
    if (!offeredOn(side, cells, set).includes(instruction)) return { side, key, blockedBy: instruction.needs };
  }
  return null;
}
