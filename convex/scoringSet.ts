// A league's scoring set: the shape #25 stores, and the check that refuses a bad one (spec/14, How
// a rule scores). The set is the league's rule, so it is always data handed in, never a constant.

import { AREAS, SLOT_POSITIONS, type Area, type SlotPosition } from "./pitch";

// The pitch's six areas are the pitch's (./pitch.ts), so a lineup and a scoring set can't disagree.
export { AREAS, type Area };

/** A value for each of the six areas. */
export type ByArea<Value> = Readonly<Record<Area, Value>>;

/** A value for each position a slot can be (pitch.ts, `positionOfSlot`). */
export type ByPosition<Value> = Readonly<Record<SlotPosition, Value>>;

/** How finely a rule's value is set (spec/14): the same for all, by area, or by the position of
 *  the slot he starts in. */
export type Priced<Value> = { all: Value } | { byArea: ByArea<Value> } | { byPosition: ByPosition<Value> };

/** Points for reaching a number of actions: 2 for 60 or more minutes is `{ atLeast: 60, points: 2 }`. */
export interface Band {
  atLeast: number;
  points: number;
}

/** The most and the least a rule pays one player for one match (FPL's defensive contribution pays
 *  at most 2); null where there is none, so a limit by area can leave an area unlimited. It holds
 *  only the rule's own points, never a role's. */
export interface PointsLimit {
  max: number | null;
  min: number | null;
}

/** What any rule may carry besides its values, each optional and priced like them (spec/14). */
interface RuleOptions {
  limit?: Priced<PointsLimit>;
  /** The minutes he must play before the rule pays anything: a clean sheet only at 60+. */
  minMinutes?: Priced<number>;
}

/** +3 per assist: the action's points, times how many he made. */
export interface PerActionRule extends RuleOptions {
  shape: "perAction";
  stat: string;
  values: Priced<number>;
}

/** +1 per 3 saves: the points for each whole `every` actions he made. */
export interface PerCountRule extends RuleOptions {
  shape: "perCount";
  stat: string;
  values: Priced<{ every: number; points: number }>;
}

/** 2 for 60+ minutes, +2 for 10+ defensive actions: each band he reaches pays when the rule
 *  stacks, or only the highest he reaches when it doesn't. A slot with no bands pays nothing. */
export interface BandsRule extends RuleOptions {
  shape: "bands";
  stat: string;
  stack: boolean;
  values: Priced<readonly Band[]>;
}

/** One rule prices one category. `stat` is the category's key in a player's one merged match
 *  record (#27); the catalogue fixes those names (spec/14, written with the first scoring set). */
export type ScoringRule = PerActionRule | PerCountRule | BandsRule;

/** A league's scoring set. A stat no rule names scores nothing, FPL's bonus among them. Points
 *  are kept in tenths; `wholePointsOnly` refuses any fraction (spec/14). */
export interface ScoringSet {
  rules: readonly ScoringRule[];
  wholePointsOnly: boolean;
}

/** The value a priced setting gives the slot he starts in. */
export function priceFor<Value>(priced: Priced<Value>, area: Area, position: SlotPosition): Value {
  if ("all" in priced) return priced.all;
  if ("byArea" in priced) return priced.byArea[area];
  return priced.byPosition[position];
}

/**
 * Refuses, with the reason, a scoring set that would score wrong: #25 calls it before saving a
 * set, and `scoreMatch` before scoring with one. Every rule is checked in every area or position
 * it is priced by, not only the one being scored, so a set missing a value can't save and then
 * fail mid-gameweek. Every number must be a number, never text JavaScript would quietly coerce.
 */
export function validateScoringSet(set: unknown): asserts set is ScoringSet {
  if (!isObject(set) || !Array.isArray(set.rules)) throw new Error("a scoring set must be a list of rules");
  if (typeof set.wholePointsOnly !== "boolean") {
    throw new Error(`a scoring set must say whether its points are whole only, true or false, not ${showValue(set.wholePointsOnly)}`);
  }
  const { wholePointsOnly } = set;
  set.rules.forEach((rule, index) => validateRule(rule, index + 1, wholePointsOnly));
}

function validateRule(rule: unknown, position: number, wholePointsOnly: boolean): void {
  if (!isObject(rule)) throw new Error(`rule ${position} of the scoring set is not a rule`);
  const { stat, shape } = rule;
  if (typeof stat !== "string" || stat === "") throw new Error(`rule ${position} of the scoring set names no stat`);
  const named = `the ${stat} rule`;
  if (shape !== "perAction" && shape !== "perCount" && shape !== "bands") {
    throw new Error(`${named} has the shape ${showValue(shape)}, which is not one of the three`);
  }
  if (shape === "bands" && typeof rule.stack !== "boolean") {
    throw new Error(`${named} must say whether its bands stack, true or false, not ${showValue(rule.stack)}`);
  }
  const points = (value: unknown, what: string) => requirePoints(value, what, wholePointsOnly);
  validatePriced(rule.values, named, "values", (values, where) => validateValues(shape, values, where, points));
  if (rule.limit !== undefined) {
    validatePriced(rule.limit, `${named}'s points limit`, "limit", (limit, where) => validateLimit(limit, where, points));
  }
  if (rule.minMinutes !== undefined) {
    validatePriced(rule.minMinutes, `${named}'s minimum minutes`, "minutes", validateMinutes);
  }
}

type CheckPoints = (value: unknown, what: string) => void;

/** Checks a priced setting has exactly one way of pricing, and a good value everywhere it says. */
function validatePriced(priced: unknown, named: string, what: string, check: (value: unknown, where: string) => void): void {
  if (!isObject(priced)) throw new Error(`${named} has no ${what}`);
  const ways = ["all", "byArea", "byPosition"].filter((way) => Object.hasOwn(priced, way));
  if (ways.length !== 1) {
    throw new Error(`${named} must be priced one way, the same for all, by area or by position, not ${ways.length}`);
  }
  if (ways[0] === "all") return check(priced.all, named);
  const keys: readonly string[] = ways[0] === "byArea" ? AREAS : SLOT_POSITIONS;
  const each = priced[ways[0]];
  if (!isObject(each)) throw new Error(`${named} has no ${what} ${ways[0] === "byArea" ? "by area" : "by position"}`);
  for (const key of keys) {
    if (!Object.hasOwn(each, key)) throw new Error(`${named} has no ${what} for ${key}`);
    check(each[key], `${named} in ${key}`);
  }
}

function validateValues(shape: ScoringRule["shape"], values: unknown, where: string, points: CheckPoints): void {
  switch (shape) {
    case "perAction":
      return points(values, `${where} pays`);
    case "perCount": {
      if (!isObject(values)) throw new Error(`${where} has no number of actions and points`);
      requireNumber(values.every, `${where} pays for every`);
      if (!(values.every > 0)) {
        throw new Error(`${where} pays for every ${values.every} actions; it must be more than 0`);
      }
      return points(values.points, `${where} pays`);
    }
    case "bands":
      return validateBands(values, where, points);
  }
}

function validateBands(bands: unknown, where: string, points: CheckPoints): void {
  if (!Array.isArray(bands)) throw new Error(`${where} has no list of bands`);
  bands.forEach((band: unknown, index) => {
    const which = `${where}, band ${index + 1},`;
    if (!isObject(band)) throw new Error(`${which} is not a band`);
    requireNumber(band.atLeast, `${which} starts at`);
    points(band.points, `${which} pays`);
  });
  if (new Set(bands.map((band: Band) => band.atLeast)).size !== bands.length) {
    throw new Error(`${where} has two bands at one threshold`);
  }
}

function validateLimit(limit: unknown, where: string, points: CheckPoints): void {
  if (!isObject(limit)) throw new Error(`${where} has no most and least`);
  if (limit.max !== null) points(limit.max, `${where} pays at most`);
  if (limit.min !== null) points(limit.min, `${where} pays at least`);
  if (limit.max !== null && limit.min !== null && (limit.min as number) > (limit.max as number)) {
    throw new Error(`${where} pays at least ${limit.min}, more than its most, ${limit.max}`);
  }
}

function validateMinutes(minutes: unknown, where: string): void {
  requireNumber(minutes, `${where} is`);
  if (minutes < 0) throw new Error(`${where} is ${minutes}; it can't be less than 0`);
}

/** A number of points: a number, in tenths, and whole when the league counts whole points only. */
function requirePoints(value: unknown, what: string, wholePointsOnly: boolean): void {
  requireNumber(value, what);
  if (wholePointsOnly && !Number.isInteger(value)) {
    throw new Error(`${what} ${value}, but the league counts whole points only`);
  }
  if (!isInTenths(value)) throw new Error(`${what} ${value}; points are kept in tenths`);
}

/** Points to the nearest tenth, which is all they are kept in: floating point's own noise goes. */
export function inTenths(points: number): number {
  return Math.round(points * 10) / 10;
}

/** Whether a number is a whole number of tenths, allowing for floating point's own noise. */
function isInTenths(value: number): boolean {
  return Math.abs(value - inTenths(value)) < 1e-9;
}

/** Throws "<what> <value>, not a number" unless it is a finite number, never coerced from text. */
export function requireNumber(value: unknown, what: string): asserts value is number {
  if (!Number.isFinite(value)) throw new Error(`${what} ${showValue(value)}, not a number`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** A bad value as the reason shows it: NaN and undefined by name, text in quotes. */
export function showValue(value: unknown): string {
  return typeof value === "number" || value === undefined ? String(value) : JSON.stringify(value);
}
