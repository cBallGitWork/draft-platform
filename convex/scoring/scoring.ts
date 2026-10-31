// A player's points for one match under a scoring set (spec/14, How a rule scores; #29): the
// site's in force that gameweek (siteScoring.ts), data the admin saves, so always an argument.

import { MINUTES_STAT } from "../stats/matchRecords";
import { withOwnStats } from "./ownStats";
import { AREAS, LANES, positionOfSlot, type Cell, type SlotPosition } from "../lineup/pitch";
import {
  priceFor,
  validateScoringSet,
  type Area,
  type Band,
  type Priced,
  type ScoringRule,
  type ScoringSet,
} from "./scoringSet";
import { inTenths, showValue, statIn, type MatchStats } from "./values";

/** One category's points, or null ("—") while his record for the match hasn't arrived. */
export interface CategoryPoints {
  stat: string;
  points: number | null;
}

/** A player's match: each rule's category in the set's order, and their total, null with them. */
export interface MatchPoints {
  total: number | null;
  categories: CategoryPoints[];
  /** His role's adjustment, in the total, when the set adjusts the role he played: each stat it
   *  adjusts that he made, and the points for it (spec/05: "Attacking full-back: +2, two key
   *  passes"). Absent when no role was given or the set adjusts none. */
  role?: RolePoints;
}

export interface RolePoints {
  /** A role's key (lineup/roles.ts). */
  role: string;
  points: number;
  lines: { stat: string; actions: number; points: number }[];
}

/** Where he starts: the slot's area, and the position its area and lane make it (pitch.ts). */
interface Slot {
  area: Area;
  position: SlotPosition;
}

/**
 * A player's points for one match, by the slot he starts in, whatever his own positions: a
 * centre-back played at full-back scores as a full-back. `record` is null while his whole record
 * for the match hasn't arrived: every category is then "—" and so is the total, never a guess.
 * Once it has arrived, a stat it leaves out is 0 (spec/14). A bad set, cell or stat throws.
 * Points are kept in tenths, so 0.1 three times is 0.3, never 0.30000000000000004.
 */
export function scoreMatch(record: MatchStats | null, set: ScoringSet, cell: Cell, role?: string): MatchPoints {
  validateScoringSet(set);
  if (!AREAS.includes(cell.area)) throw new Error(`${showValue(cell.area)} is not one of the pitch's six areas`);
  if (!LANES.includes(cell.lane)) throw new Error(`${showValue(cell.lane)} is not one of the pitch's five lanes`);
  if (record === null) {
    return { total: null, categories: set.rules.map((rule) => ({ stat: rule.stat, points: null })) };
  }
  const slot = { area: cell.area, position: positionOfSlot(cell) };
  record = withOwnStats(record, set);
  const minutes = statIn(record, MINUTES_STAT);
  const categories = set.rules.map((rule) => ({
    stat: rule.stat,
    points: rulePoints(rule, slot, statIn(record, rule.stat), minutes),
  }));
  const base = sum(categories.map((category) => category.points));
  const adjusted = role === undefined ? undefined : rolePoints(record, set, role);
  if (adjusted === undefined) return { total: inTenths(base), categories };
  return { total: inTenths(base + adjusted.points), categories, role: adjusted };
}

/** The role's adjustment for this record: flat points per action, on top of every rule and its
 *  points limit (spec/14). Undefined when the set doesn't adjust the role. */
function rolePoints(record: MatchStats, set: ScoringSet, role: string): RolePoints | undefined {
  const adjusting = set.roleAdjustments?.find((each) => each.role === role);
  if (adjusting === undefined) return undefined;
  const lines = adjusting.adjustments
    .map(({ stat, points }) => ({ stat, actions: statIn(record, stat), points: inTenths(statIn(record, stat) * points) }))
    .filter(({ actions }) => actions !== 0);
  return { role, points: inTenths(sum(lines.map((line) => line.points))), lines };
}

/** A rule's points for the slot: nothing below its minimum minutes, then held to its points
 *  limit. Points too large to be a number throw. */
function rulePoints(rule: ScoringRule, slot: Slot, actions: number, minutes: number): number {
  const price: Price = (priced) => priceFor(priced, slot.area, slot.position);
  if (rule.minMinutes !== undefined && minutes < price(rule.minMinutes)) return 0;
  let points = pointsByShape(rule, price, actions);
  if (rule.limit !== undefined) {
    const { max, min } = price(rule.limit);
    if (max !== null) points = Math.min(points, max);
    if (min !== null) points = Math.max(points, min);
  }
  if (!Number.isFinite(points)) throw new Error(`the ${rule.stat} rule gives ${points} points as ${slot.position}`);
  return inTenths(points);
}

/** One rule's points for a man priced at `cell`, with `actions` of its stat and `minutes` played:
 *  what a threshold line prices the step it shows by (#44). A bad cell is the caller's to check. */
export function rulePointsIn(rule: ScoringRule, cell: Cell, actions: number, minutes: number): number {
  return rulePoints(rule, { area: cell.area, position: positionOfSlot(cell) }, actions, minutes);
}

/** A rule's setting for the slot being scored. */
type Price = <Value>(priced: Priced<Value>) => Value;

function pointsByShape(rule: ScoringRule, price: Price, actions: number): number {
  switch (rule.shape) {
    case "perAction":
      return actions * price(rule.values);
    case "perCount": {
      const { every, points } = price(rule.values);
      return Math.floor(actions / every) * points;
    }
    case "bands":
      return bandPoints(price(rule.values), rule.stack, actions);
  }
}

function bandPoints(bands: readonly Band[], stack: boolean, actions: number): number {
  const reached = bands.filter((band) => actions >= band.atLeast);
  if (stack) return sum(reached.map((band) => band.points));
  const highest = reached.toSorted((one, other) => other.atLeast - one.atLeast)[0];
  return highest?.points ?? 0;
}

function sum(numbers: readonly number[]): number {
  return numbers.reduce((total, each) => total + each, 0);
}

/** A league's double-gameweek rule (spec/03): both matches count, or only his best match. */
export const DOUBLE_GAMEWEEK_RULES = ["bothMatches", "bestMatch"] as const;
export type DoubleGameweekRule = (typeof DOUBLE_GAMEWEEK_RULES)[number];

/** A player's gameweek. Provisional while any of his matches' records hasn't arrived: the points
 *  are those of the matches that have, and null while none has. A match still live or inside its
 *  correction window is provisional too, which is the match's own state (spec/07), not this. */
export interface GameweekPoints {
  points: number | null;
  provisional: boolean;
}

/** A player's gameweek from his matches in it, under the league's double-gameweek rule. With one
 *  match the rule changes nothing; with none he scores 0. */
export function scoreGameweek(matches: readonly MatchPoints[], rule: DoubleGameweekRule): GameweekPoints {
  const counted = countedMatches(matches, rule);
  const arrived = matches.flatMap((match) => (match.total === null ? [] : [match.total]));
  const provisional = arrived.length < matches.length;
  if (matches.length === 0) return { points: 0, provisional };
  if (arrived.length === 0) return { points: null, provisional };
  const counting = matches.flatMap((match, index) => (counted[index] && match.total !== null ? [match.total] : []));
  // Each match's total is in tenths; their sum is put back in tenths too (spec/14).
  return { points: inTenths(sum(counting)), provisional };
}

/** Which of a player's matches in the gameweek his points include, in the order his matches came:
 *  under both matches, all; under best match, the highest-scoring, the first of them on a tie. A
 *  match whose record hasn't arrived adds nothing yet, but is counted, as it may yet be his best.
 *  His card reads its labels from this (scoredMatches.ts), so it never disagrees with his points. */
export function countedMatches(matches: readonly MatchPoints[], rule: DoubleGameweekRule): boolean[] {
  if (!DOUBLE_GAMEWEEK_RULES.includes(rule)) {
    throw new Error(`a double-gameweek rule of ${JSON.stringify(rule)} is neither both matches nor best match`);
  }
  if (rule === "bothMatches") return matches.map(() => true);
  const best = matches.reduce<number | null>((found, match, index) => {
    if (match.total === null) return found;
    return found === null || match.total > matches[found].total! ? index : found;
  }, null);
  return matches.map((match, index) => match.total === null || index === best);
}
