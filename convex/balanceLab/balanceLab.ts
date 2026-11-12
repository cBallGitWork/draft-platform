import { FIRST_INSTRUCTIONS, shapeAllows } from "../lineup/instructions";
import { STARTER_COUNT } from "../lineup/lineup";
import { positionOfSlot, type Cell, type SlotPosition } from "../lineup/pitch";
import { DEFAULT_ROLES } from "../lineup/roles";
import { PAST_STAT_COLUMNS } from "../pastSeasons/pastStatColumns";
import { instructionTotal, roleTotal } from "../scoring/scoring";
import type { ScoringSet } from "../scoring/scoringSet";
import { ROLE_TARGET_MARGIN } from "./balanceLabLimits";
import type { LabInstruction, LabReport, LabRole } from "./labReportShape";

// The rule balance lab (spec/14, The rule balance lab; #843): a backtest of a patch draft on the
// past seasons' real starts, "just to make sure a change is good". Pure: it saves nothing, so
// locked gameweeks keep their scores. Craig's answers on #843 (6 and 7 Nov 2026) settle it:
// - each role's average a start over its slot's real starts, against the slot's target role bonus
//   (spec/05 Roles), flagged more than ROLE_TARGET_MARGIN off it;
// - a past start counts in the slot his position in that match's starting line-up maps to, never
//   his FPL position; a start whose position maps to none is left out, and counted as skipped;
// - a role scoring a stat the past seasons weren't copied with (pastStatColumns.ts) is "not
//   tested", naming those stats, with no average and no flag;
// - a copied stat blank in one match leaves that match out of the role's average only (Craig,
//   6 Nov 2026, on #842), and the starts it was tested on are shown;
// - no biggest movers and no what-ifs on this season's results ("Drop what ifs").
// Each team instruction's average is for a whole XI (S14.9; Craig's answers on #1541, 12 Nov 2026):
// a club's eleven starters in one past match, each scored on his full match even after he came off,
// no sub counted, the shape read from where the starters lined up, and only XIs in a shape that
// allows the instruction. A stat blank for one starter counts as 0 ("zero is a number"). One
// scoring a stat that wasn't copied is "not tested", naming it (S14.13).

/** Each slot's target role bonus a start (spec/05 Roles: half its gap in base points to strikers,
 *  plus 0.5 for every slot; Craig, 4 Nov 2026). */
const ROLE_TARGETS: Readonly<Record<SlotPosition, number>> = {
  ST: 0.5,
  W: 0.6,
  CAM: 0.6,
  WM: 0.8,
  GK: 0.9,
  WB: 1.0,
  CM: 1.0,
  FB: 1.1,
  CDM: 1.1,
  CB: 1.2,
};

const cell = (area: Cell["area"], lane: Cell["lane"]): Cell => ({ area, lane });

/** Where the past seasons' log says he started (ai-carling's codes, as Football Manager writes
 *  them), and the pitch's cell it stands for: so the slot it maps to (spec/14, How a rule scores:
 *  left and right alike), and the shape his club's XI stood in (S14.9). A code not here maps to no
 *  cell, and the start is skipped. */
const CELL_OF_STARTING_POSITION: Readonly<Record<string, Cell>> = {
  GK: cell("goalkeeper", "centre"),
  DL: cell("defence", "left"),
  DCL: cell("defence", "leftCentre"),
  DC: cell("defence", "centre"),
  DCR: cell("defence", "rightCentre"),
  DR: cell("defence", "right"),
  WBL: cell("defensiveMidfield", "left"),
  DML: cell("defensiveMidfield", "left"),
  DM: cell("defensiveMidfield", "centre"),
  DMC: cell("defensiveMidfield", "centre"),
  WBR: cell("defensiveMidfield", "right"),
  DMR: cell("defensiveMidfield", "right"),
  ML: cell("midfield", "left"),
  MCL: cell("midfield", "leftCentre"),
  MC: cell("midfield", "centre"),
  MCR: cell("midfield", "rightCentre"),
  MR: cell("midfield", "right"),
  AML: cell("attackingMidfield", "left"),
  AMCL: cell("attackingMidfield", "leftCentre"),
  AMC: cell("attackingMidfield", "centre"),
  AMCR: cell("attackingMidfield", "rightCentre"),
  AMR: cell("attackingMidfield", "right"),
  STL: cell("attack", "leftCentre"),
  ST: cell("attack", "centre"),
  STC: cell("attack", "centre"),
  FC: cell("attack", "centre"),
  STR: cell("attack", "rightCentre"),
};

/** The cell a starting position stands for, or null for one that maps to none. */
const cellOfStart = (startingPosition: string): Cell | null => CELL_OF_STARTING_POSITION[startingPosition.trim().toUpperCase()] ?? null;

/** The slot a starting position stands for, or null for one that maps to none. */
export function slotOfStart(startingPosition: string): SlotPosition | null {
  const at = cellOfStart(startingPosition);
  return at === null ? null : positionOfSlot(at);
}

/** One real start in a past season: the year the season starts, the match's kickoff, the club he
 *  started for (absent on a row copied before #1541), where he started, and his stats. */
export interface PastStart {
  season: number;
  kickoff: number;
  club?: string;
  startingPosition: string;
  stats: Readonly<Record<string, number>>;
}

/** The catalogue stats `counted` stands for, an own stat taken as its parts, A to Z. */
function catalogueStats(set: ScoringSet, counted: readonly { stat: string }[]): string[] {
  const stats = new Set<string>();
  for (const { stat } of counted) {
    const own = set.ownStats?.find((each) => each.stat === stat);
    for (const part of own?.parts ?? [{ stat }]) stats.add(part.stat);
  }
  return [...stats].sort();
}

/** The catalogue stats a role's bonus and cost count, an own stat taken as its parts, A to Z. */
export function roleStats(set: ScoringSet, role: string): string[] {
  const scoring = set.roles?.find((each) => each.role === role);
  return scoring === undefined ? [] : catalogueStats(set, [...scoring.bonus.parts, ...scoring.cost.parts]);
}

/** Those of `stats` the past seasons weren't copied with. */
const notCopied = (stats: readonly string[]): string[] => stats.filter((stat) => !(stat in PAST_STAT_COLUMNS));

/** In hundredths, so a flag is never one floating point's noise. */
const hundredths = (points: number): number => Math.round(points * 100);

/** The average of `total` over `count`, to the hundredth; null over none. */
const averageOf = (total: number, count: number): number | null => (count === 0 ? null : hundredths(total / count) / 100);

/** One starter of a club's XI: where he stood, and his stats for the whole match. */
interface XiStarter {
  at: Cell;
  stats: Readonly<Record<string, number>>;
}

/** Each club's real XI in each past match: its starters whose position maps to a cell, by the
 *  season, the kickoff and the club. A start copied with no club (before #1541) is in none. */
function clubXis(starts: readonly PastStart[]): XiStarter[][] {
  const xis = new Map<string, XiStarter[]>();
  for (const { season, kickoff, club, startingPosition, stats } of starts) {
    if (club === undefined) continue;
    const at = cellOfStart(startingPosition);
    if (at === null) continue;
    const key = JSON.stringify([season, kickoff, club]);
    const xi = xis.get(key);
    if (xi === undefined) xis.set(key, [{ at, stats }]);
    else xi.push({ at, stats });
  }
  return [...xis.values()];
}

/** A whole XI's points from an instruction: each starter's, at his slot, on his full match. */
const xiPoints = (xi: readonly XiStarter[], set: ScoringSet, key: string): number =>
  xi.reduce((total, { at, stats }) => total + instructionTotal(stats, set, key, positionOfSlot(at)), 0);

/** Each team instruction the set scores, in its order: its average for a whole XI over the clubs'
 *  real XIs in a shape that allows it, or, where it scores a stat the past seasons lack, not tested,
 *  naming those stats A to Z. An instruction outside the first set (FIRST_INSTRUCTIONS) needs no
 *  shape. */
function labInstructions(set: ScoringSet, xis: readonly XiStarter[][]): LabInstruction[] {
  return (set.instructions ?? []).map(({ instruction, lines }) => {
    const missing = notCopied(catalogueStats(set, lines.flatMap((line) => line.stats)));
    if (missing.length > 0) return { instruction, missing };
    const needs = FIRST_INSTRUCTIONS.find((each) => each.key === instruction)?.needs ?? "anyShape";
    const allowed = xis.filter((xi) => shapeAllows(needs, xi.map(({ at }) => at)));
    const total = allowed.reduce((sum, xi) => sum + xiPoints(xi, set, instruction), 0);
    return { instruction, xis: allowed.length, average: averageOf(total, allowed.length) };
  });
}

/** The lab's report on `set` from the past seasons' real starts: each role the set scores, slot by
 *  slot in SLOT_POSITIONS' order (DEFAULT_ROLES'), tested or not, and each team instruction it
 *  scores. */
export function balanceLab(set: ScoringSet, starts: readonly PastStart[]): LabReport {
  const bySlot = new Map<SlotPosition, PastStart[]>();
  let skipped = 0;
  for (const start of starts) {
    const slot = slotOfStart(start.startingPosition);
    if (slot === null) {
      skipped += 1;
      continue;
    }
    const held = bySlot.get(slot);
    if (held === undefined) bySlot.set(slot, [start]);
    else held.push(start);
  }
  const roles: LabRole[] = [];
  for (const [slot, offered] of Object.entries(DEFAULT_ROLES) as [SlotPosition, (typeof DEFAULT_ROLES)[SlotPosition]][]) {
    const target = ROLE_TARGETS[slot];
    for (const { key: role } of offered) {
      if (set.roles?.some((each) => each.role === role) !== true) continue;
      const stats = roleStats(set, role);
      const missing = notCopied(stats);
      if (missing.length > 0) {
        roles.push({ role, slot, target, missing });
        continue;
      }
      const tested = (bySlot.get(slot) ?? []).filter((start) => stats.every((stat) => stat in start.stats));
      const total = tested.reduce((sum, start) => sum + roleTotal(start.stats, set, role), 0);
      const average = averageOf(total, tested.length);
      const offTarget = average !== null && Math.abs(hundredths(average) - hundredths(target)) > hundredths(ROLE_TARGET_MARGIN);
      roles.push({ role, slot, target, starts: tested.length, average, offTarget });
    }
  }
  const xis = clubXis(starts);
  return {
    seasons: [...new Set(starts.map((start) => start.season))].sort((a, b) => a - b),
    starts: starts.length - skipped,
    startsSkipped: skipped,
    roles,
    instructions: labInstructions(set, xis),
    xis: xis.length,
    xisShort: xis.filter((xi) => xi.length < STARTER_COUNT).length,
  };
}
