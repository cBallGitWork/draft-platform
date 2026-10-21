// A league's scoring set: the shape #25 stores, and the check that refuses a bad one (spec/14, How
// a rule scores). The set is the league's rule, so it is always data handed in, never a constant.

import { AREAS, type Area } from "./pitch";

// The pitch's six areas are the pitch's (./pitch.ts), so a lineup and a scoring set can't disagree.
export { AREAS, type Area };

/** A value for each of the six areas: a league sets every rule's values per area. */
export type ByArea<Value> = Readonly<Record<Area, Value>>;

/** Points for reaching a number of actions: 2 for 60 or more minutes is `{ atLeast: 60, points: 2 }`. */
export interface Band {
  atLeast: number;
  points: number;
}

/** +3 per assist: the action's points, times how many he made. */
export interface PerActionRule {
  shape: "perAction";
  stat: string;
  byArea: ByArea<number>;
}

/** +1 per 3 saves: the points for each whole `every` actions he made. */
export interface PerCountRule {
  shape: "perCount";
  stat: string;
  byArea: ByArea<{ every: number; points: number }>;
}

/** 2 for 60+ minutes, +2 for 10+ defensive actions: each band he reaches pays when the rule
 *  stacks, or only the highest he reaches when it doesn't. An area with no bands pays nothing. */
export interface BandsRule {
  shape: "bands";
  stat: string;
  stack: boolean;
  byArea: ByArea<readonly Band[]>;
}

/** One rule prices one category. `stat` is the category's key in a player's one merged match
 *  record (#27); the catalogue fixes those names (spec/14, written with the first scoring set). */
export type ScoringRule = PerActionRule | PerCountRule | BandsRule;

/** A league's scoring set. A stat no rule names scores nothing, FPL's bonus among them. */
export interface ScoringSet {
  rules: readonly ScoringRule[];
}

/**
 * Refuses, with the reason, a scoring set that would score wrong: #25 calls it before saving a
 * set, and `scoreMatch` before scoring with one. Every rule is checked in all six areas, not only
 * the one being scored, so a set missing one area's values can't save and then fail mid-gameweek.
 * Every number must be a number, never text JavaScript would quietly coerce.
 */
export function validateScoringSet(set: unknown): asserts set is ScoringSet {
  if (!isObject(set) || !Array.isArray(set.rules)) throw new Error("a scoring set must be a list of rules");
  set.rules.forEach((rule, index) => validateRule(rule, index + 1));
}

function validateRule(rule: unknown, position: number): void {
  if (!isObject(rule)) throw new Error(`rule ${position} of the scoring set is not a rule`);
  const { stat, shape, byArea } = rule;
  if (typeof stat !== "string" || stat === "") throw new Error(`rule ${position} of the scoring set names no stat`);
  const named = `the ${stat} rule`;
  if (shape !== "perAction" && shape !== "perCount" && shape !== "bands") {
    throw new Error(`${named} has the shape ${showValue(shape)}, which is not one of the three`);
  }
  if (shape === "bands" && typeof rule.stack !== "boolean") {
    throw new Error(`${named} must say whether its bands stack, true or false, not ${showValue(rule.stack)}`);
  }
  if (!isObject(byArea)) throw new Error(`${named} has no values by area`);
  for (const area of AREAS) {
    if (!Object.hasOwn(byArea, area)) throw new Error(`${named} has no values for ${area}`);
    validateAreaValues(shape, byArea[area], `${named} in ${area}`);
  }
}

function validateAreaValues(shape: ScoringRule["shape"], values: unknown, where: string): void {
  switch (shape) {
    case "perAction":
      return requireNumber(values, `${where} pays`);
    case "perCount": {
      if (!isObject(values)) throw new Error(`${where} has no number of actions and points`);
      requireNumber(values.every, `${where} pays for every`);
      if (!(values.every > 0)) {
        throw new Error(`${where} pays for every ${values.every} actions; it must be more than 0`);
      }
      return requireNumber(values.points, `${where} pays`);
    }
    case "bands":
      return validateBands(values, where);
  }
}

function validateBands(bands: unknown, where: string): void {
  if (!Array.isArray(bands)) throw new Error(`${where} has no list of bands`);
  bands.forEach((band: unknown, index) => {
    const which = `${where}, band ${index + 1},`;
    if (!isObject(band)) throw new Error(`${which} is not a band`);
    requireNumber(band.atLeast, `${which} starts at`);
    requireNumber(band.points, `${which} pays`);
  });
  if (new Set(bands.map((band: Band) => band.atLeast)).size !== bands.length) {
    throw new Error(`${where} has two bands at one threshold`);
  }
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
