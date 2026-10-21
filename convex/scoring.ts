// A player's points for one match under a league's scoring set (spec/14, How a rule scores; #29).
// The scoring set is the league's rule, so it is always an argument, never a constant.

import { MINUTES_STAT } from "./matchRecords";
import { AREAS, LANES, positionOfSlot, type Cell, type SlotPosition } from "./pitch";
import {
  inTenths,
  priceFor,
  requireNumber,
  showValue,
  validateScoringSet,
  type Area,
  type Band,
  type Priced,
  type ScoringRule,
  type ScoringSet,
} from "./scoringSet";

/** A player's stats for one match, by the feeds' own keys. */
export type MatchStats = Readonly<Record<string, number>>;

/** One category's points, or null ("—") while his record for the match hasn't arrived. */
export interface CategoryPoints {
  stat: string;
  points: number | null;
}

/** A player's match: each rule's category in the set's order, and their total, null with them. */
export interface MatchPoints {
  total: number | null;
  categories: CategoryPoints[];
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
export function scoreMatch(record: MatchStats | null, set: ScoringSet, cell: Cell): MatchPoints {
  validateScoringSet(set);
  if (!AREAS.includes(cell.area)) throw new Error(`${showValue(cell.area)} is not one of the pitch's six areas`);
  if (!LANES.includes(cell.lane)) throw new Error(`${showValue(cell.lane)} is not one of the pitch's five lanes`);
  if (record === null) {
    return { total: null, categories: set.rules.map((rule) => ({ stat: rule.stat, points: null })) };
  }
  const slot = { area: cell.area, position: positionOfSlot(cell) };
  const minutes = statIn(record, MINUTES_STAT);
  const categories = set.rules.map((rule) => ({
    stat: rule.stat,
    points: rulePoints(rule, slot, statIn(record, rule.stat), minutes),
  }));
  return { total: inTenths(sum(categories.map((category) => category.points))), categories };
}

/** Only the record's own keys count: a rule on `constructor` must not read Object's. A stat the
 *  feeds sent as anything but a number is bad data, never 0. */
function statIn(record: MatchStats, stat: string): number {
  if (!Object.hasOwn(record, stat)) return 0;
  const actions = record[stat];
  requireNumber(actions, `his record's ${stat} is`);
  return actions;
}

/** A rule's points for the slot: nothing below its minimum minutes, then held to its points
 *  limit. Points too large to be a number throw. No action under a negative rule (0 yellow cards
 *  at -1) is -0 in JavaScript, which a saved row or a test tells apart from 0, so it is made 0. */
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
  points = inTenths(points);
  return points === 0 ? 0 : points;
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
export type DoubleGameweekRule = "bothMatches" | "bestMatch";

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
  if (rule !== "bothMatches" && rule !== "bestMatch") {
    throw new Error(`a double-gameweek rule of ${JSON.stringify(rule)} is neither both matches nor best match`);
  }
  const arrived = matches.flatMap((match) => (match.total === null ? [] : [match.total]));
  const provisional = arrived.length < matches.length;
  if (matches.length === 0) return { points: 0, provisional };
  if (arrived.length === 0) return { points: null, provisional };
  const points = rule === "bestMatch" ? Math.max(...arrived) : sum(arrived);
  return { points, provisional };
}
