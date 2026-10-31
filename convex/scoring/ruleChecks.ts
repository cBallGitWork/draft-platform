// One rule's checks, for `validateScoringSet` (scoringSet.ts): its stat, shape and values, its
// points limit and minimum minutes, each priced one way; and the check that a number is points.

import { AREAS, SLOT_POSITIONS } from "../lineup/pitch";
import type { Band, ScoringRule } from "./scoringSet";
import { inTenths, isObject, requireNumber, showValue, UnsoundScoring } from "./values";

/** A rule is named by its category's full name, as the rules editor shows it (spec/14). It scores
 *  a catalogue stat or one of the set's own, never a key no record holds: a typo such as
 *  `goals_scroed` would otherwise give every player 0 in it, with no error (#135). */
export function validateRule(
  rule: unknown,
  position: number,
  wholePointsOnly: boolean,
  isScorable: (stat: string) => boolean,
  nameOf: (stat: string) => string,
): void {
  if (!isObject(rule)) throw new UnsoundScoring(`rule ${position} of the scoring set is not a rule`);
  const { stat, shape } = rule;
  if (typeof stat !== "string" || stat === "") throw new UnsoundScoring(`rule ${position} of the scoring set names no stat`);
  if (!isScorable(stat)) {
    throw new UnsoundScoring(`rule ${position} of the scoring set scores ${showValue(stat)}, which is neither a catalogue stat nor one of the set's own stats`);
  }
  const named = `the ${nameOf(stat)} rule`;
  if (shape !== "perAction" && shape !== "perCount" && shape !== "bands") {
    throw new UnsoundScoring(`${named} has the shape ${showValue(shape)}, which is not one of the three`);
  }
  if (shape === "bands" && typeof rule.stack !== "boolean") {
    throw new UnsoundScoring(`${named} must say whether its bands stack, true or false, not ${showValue(rule.stack)}`);
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
  if (!isObject(priced)) throw new UnsoundScoring(`${named} has no ${what}`);
  const ways = ["all", "byArea", "byPosition"].filter((way) => Object.hasOwn(priced, way));
  if (ways.length !== 1) {
    throw new UnsoundScoring(`${named} must be priced one way, the same for all, by area or by position, not ${ways.length}`);
  }
  if (ways[0] === "all") return check(priced.all, named);
  const keys: readonly string[] = ways[0] === "byArea" ? AREAS : SLOT_POSITIONS;
  const each = priced[ways[0]];
  if (!isObject(each)) throw new UnsoundScoring(`${named} has no ${what} ${ways[0] === "byArea" ? "by area" : "by position"}`);
  for (const key of keys) {
    if (!Object.hasOwn(each, key)) throw new UnsoundScoring(`${named} has no ${what} for ${key}`);
    check(each[key], `${named} in ${key}`);
  }
}

function validateValues(shape: ScoringRule["shape"], values: unknown, where: string, points: CheckPoints): void {
  switch (shape) {
    case "perAction":
      return points(values, `${where} is worth`);
    case "perCount": {
      if (!isObject(values)) throw new UnsoundScoring(`${where} has no number of actions and points`);
      requireNumber(values.every, `${where} is worth points for every`);
      if (!(values.every > 0)) {
        throw new UnsoundScoring(`${where} is worth points for every ${values.every} actions; it must be more than 0`);
      }
      return points(values.points, `${where} is worth`);
    }
    case "bands":
      return validateBands(values, where, points);
  }
}

function validateBands(bands: unknown, where: string, points: CheckPoints): void {
  if (!Array.isArray(bands)) throw new UnsoundScoring(`${where} has no list of bands`);
  bands.forEach((band: unknown, index) => {
    const which = `${where}, band ${index + 1},`;
    if (!isObject(band)) throw new UnsoundScoring(`${which} is not a band`);
    requireNumber(band.atLeast, `${which} starts at`);
    points(band.points, `${which} is worth`);
  });
  if (new Set(bands.map((band: Band) => band.atLeast)).size !== bands.length) {
    throw new UnsoundScoring(`${where} has two bands at one threshold`);
  }
}

function validateLimit(limit: unknown, where: string, points: CheckPoints): void {
  if (!isObject(limit)) throw new UnsoundScoring(`${where} has no most and least`);
  if (limit.max !== null) points(limit.max, `${where} is worth at most`);
  if (limit.min !== null) points(limit.min, `${where} is worth at least`);
  if (limit.max !== null && limit.min !== null && (limit.min as number) > (limit.max as number)) {
    throw new UnsoundScoring(`${where} is worth at least ${limit.min}, more than its most, ${limit.max}`);
  }
}

function validateMinutes(minutes: unknown, where: string): void {
  requireNumber(minutes, `${where} is`);
  if (minutes < 0) throw new UnsoundScoring(`${where} is ${minutes}; it can't be less than 0`);
}

/** A number of points: a number, in tenths, and whole when the set counts whole points only. */
export function requirePoints(value: unknown, what: string, wholePointsOnly: boolean): void {
  requireNumber(value, what);
  if (wholePointsOnly && !Number.isInteger(value)) {
    throw new UnsoundScoring(`${what} ${value}, but the set counts whole points only`);
  }
  if (!isInTenths(value)) throw new UnsoundScoring(`${what} ${value}; points are kept in tenths`);
}

/** How far a number may sit from its tenth and still be in tenths: floating point's own noise. */
const FLOAT_NOISE = 1e-9;

/** Whether a number is a whole number of tenths, allowing for floating point's own noise. */
function isInTenths(value: number): boolean {
  return Math.abs(value - inTenths(value)) < FLOAT_NOISE;
}
