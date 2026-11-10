// What a man's team adds to his match (spec/05, Team instructions; #990): its two instructions,
// each scored on his own club's match, and its formation's back line, which reprices his clean sheet
// and goals conceded in its keeper and defence slots. scoring.ts's scoreMatch reads both.

import type { BackLineScoring } from "../lineup/presets";
import type { Area, SlotPosition } from "../lineup/pitch";
import type { ScoringRule, ScoringSet } from "./scoringSet";
import { statIn, weighedCount, type MatchStats } from "./values";

/** One instruction's points in a match: each of its lines that moved him, added up. */
export interface InstructionPoints {
  /** An instruction's key (lineup/instructions.ts). */
  instruction: string;
  points: number;
  /** Each line that moved his points: what it gave, and each of its stats he made. */
  lines: { points: number; stats: { stat: string; actions: number }[] }[];
}

/** What his team adds to his match: the two instructions it picked, and its formation's back line. */
export interface TeamScoring {
  /** By key: the attacking and the defensive. */
  instructions: readonly string[];
  /** The values that replace the set's clean sheet and goals conceded for its keeper and defence
   *  slots, with the formation that holds them; null for none. */
  backLine: { formation: string; scoring: BackLineScoring } | null;
}

/** The slots a formation's back line scores (Craig, 9 Nov 2026, on #990: "a two-at-the-back side's
 *  keeper and defence slots"). */
const BACK_LINE_AREAS: ReadonlySet<Area> = new Set(["goalkeeper", "defence"]);

/** FPL's stats a back line prices: the feed's fixed names (spec/14's catalogue). */
const CLEAN_SHEETS_STAT = "clean_sheets";
const GOALS_CONCEDED_STAT = "goals_conceded";

/** The back line that prices a man at a slot in `area`: the team's, in its keeper and defence
 *  slots; else null. */
export function backLineAt(team: TeamScoring | undefined, area: Area): TeamScoring["backLine"] {
  return team?.backLine != null && BACK_LINE_AREAS.has(area) ? team.backLine : null;
}

/** The rule as a back line prices it: a clean sheet and each goal conceded at the formation's
 *  values, the rule's minimum minutes and points limit kept; any other rule as it is. */
export function withBackLine(rule: ScoringRule, scoring: BackLineScoring): ScoringRule {
  const { shape: _shape, values: _values, ...kept } = rule;
  if (rule.stat === CLEAN_SHEETS_STAT) return { ...kept, shape: "perAction", values: { all: scoring.cleanSheet } };
  if (rule.stat === GOALS_CONCEDED_STAT) return { ...kept, shape: "perCount", values: { all: { every: 1, points: scoring.goalConceded } } };
  return rule;
}

/** An instruction's points for this record, own stats worked out, at a slot standing for
 *  `position` (spec/05, Team instructions): each of its lines that scores the slot gives its points
 *  for each whole `every` of its weighed count, held to its most, and nothing below its minimum
 *  minutes. Undefined when the set doesn't score it. */
export function instructionPoints(record: MatchStats, set: ScoringSet, key: string, position: SlotPosition, minutes: number): InstructionPoints | undefined {
  const scoring = set.instructions?.find((each) => each.instruction === key);
  if (scoring === undefined) return undefined;
  const lines = scoring.lines.flatMap((line) => {
    if (line.positions !== undefined && !line.positions.includes(position)) return [];
    if (line.minMinutes !== undefined && minutes < line.minMinutes) return [];
    const uncut = Math.floor(weighedCount(record, line.stats) / line.every) * line.points;
    const points = line.most === undefined ? uncut : Math.max(-line.most, Math.min(line.most, uncut));
    if (points === 0) return [];
    return [{ points, stats: line.stats.map(({ stat }) => ({ stat, actions: statIn(record, stat) })).filter(({ actions }) => actions !== 0) }];
  });
  return { instruction: key, points: lines.reduce((total, line) => total + line.points, 0), lines };
}
