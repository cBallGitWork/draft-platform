// The site's scoring set (spec/14, Who owns it; #354): its shape, and the check that refuses a
// bad one (spec/14, How a rule scores; each rule's checks are ruleChecks.ts's). The set is data the
// admin saves, so scoring is always handed it.

import { AREAS, type Area } from "../lineup/pitch";
import { categoryName } from "./categories";
import { validateOwnStats, type OwnStat } from "./ownStats";
import type { Priced } from "./priced";
import { validateRule } from "./ruleChecks";
import { CATALOGUE_STATS } from "./statCatalogue";
import { isObject, requireNumber, showValue, UnsoundScoring } from "./values";

export type { OwnStat };

// The pitch's six areas are the pitch's (../lineup/pitch.ts), so a lineup and a scoring set can't disagree.
export { AREAS, type Area };

/** Points for reaching a number of actions: 2 for 60 or more minutes is `{ atLeast: 60, points: 2 }`. */
export interface Band {
  atLeast: number;
  points: number;
}

/** The most and the least one player earns from a rule in one match (FPL's defensive contribution gives
 *  at most 2); null where there is none, so a limit by area can leave an area unlimited. It holds
 *  only the rule's own points, never a role's. */
export interface PointsLimit {
  max: number | null;
  min: number | null;
}

/** What any rule may carry besides its values, each optional and priced like them (spec/14). */
interface RuleOptions {
  limit?: Priced<PointsLimit>;
  /** The minutes he must play before he earns anything from the rule: a clean sheet only at 60+. */
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

/** 2 for 60+ minutes, +2 for 10+ defensive actions: he earns each band he reaches when the rule
 *  stacks, or only the highest he reaches when it doesn't. A slot with no bands earns nothing. */
export interface BandsRule extends RuleOptions {
  shape: "bands";
  stat: string;
  stack: boolean;
  values: Priced<readonly Band[]>;
}

/** One rule prices one category. `stat` is the category's key in a player's one merged match
 *  record (#27); the catalogue fixes those names (spec/14, written with the first scoring set). */
export type ScoringRule = PerActionRule | PerCountRule | BandsRule;

/** A scoring set. A stat no rule names scores nothing, FPL's bonus among them. Points
 *  are kept in tenths; `wholePointsOnly` refuses any fraction, and counts an own stat's whole
 *  actions only (spec/14). */
export interface ScoringSet {
  rules: readonly ScoringRule[];
  wholePointsOnly: boolean;
  ownStats?: readonly OwnStat[];
  /** Each role's scoring (spec/05 Roles): whole points by bars, added to a starter's base points
   *  on top of every rule and its points limit (spec/14). A role it doesn't name scores nothing;
   *  a set with none scores no role. */
  roles?: readonly RoleScoring[];
}

/** The most bars a side of a role has, so a role moves a match by at most 3 either way (spec/05:
 *  "±3, chosen over ±2", Craig, 5 Nov 2026). */
export const ROLE_BARS_MOST = 3;

/** One side of a role: its stats, each weighed (2 × goals, ½ recoveries, accurate passes ÷ 10),
 *  added up into a count, and its bars, rising: the count gives a point at each it reaches. */
export interface RoleSide {
  parts: readonly { stat: string; weight: number }[];
  bars: readonly number[];
}

/** One role's scoring (spec/05 Roles): +1 at each bar of its bonus reached, −1 at each bar of its
 *  cost, which is one bad action, never a good one. */
export interface RoleScoring {
  /** A role's key (lineup/roles.ts). */
  role: string;
  bonus: RoleSide;
  cost: RoleSide;
}

/**
 * Refuses, with the reason, a scoring set that would score wrong: #25 calls it before saving a
 * set, and `scoreMatch` before scoring with one. Every rule is checked in every area or position
 * it is priced by, not only the one being scored, so a set missing a value can't save and then
 * fail mid-gameweek. Every number must be a number, never text JavaScript would quietly coerce.
 */
export function validateScoringSet(set: unknown): asserts set is ScoringSet {
  if (!isObject(set) || !Array.isArray(set.rules)) throw new UnsoundScoring("a scoring set must be a list of rules");
  if (typeof set.wholePointsOnly !== "boolean") {
    throw new UnsoundScoring(`a scoring set must say whether its points are whole only, true or false, not ${showValue(set.wholePointsOnly)}`);
  }
  const { wholePointsOnly } = set;
  if (set.ownStats !== undefined) validateOwnStats(set.ownStats);
  const ownStats = set.ownStats as readonly OwnStat[] | undefined;
  const isScorable = (stat: string) => CATALOGUE_STATS.has(stat) || (ownStats ?? []).some((own) => own.stat === stat);
  set.rules.forEach((rule, index) =>
    validateRule(rule, index + 1, wholePointsOnly, isScorable, (stat) => categoryName(stat, ownStats)),
  );
  if (set.roles !== undefined) validateRoles(set.roles, isScorable, (stat) => categoryName(stat, ownStats));
}

/** Each role named once, and both its sides sound. */
function validateRoles(roles: unknown, isScorable: (stat: string) => boolean, nameOf: (stat: string) => string): void {
  if (!Array.isArray(roles)) throw new UnsoundScoring("a scoring set's roles must be a list");
  const seen = new Set<string>();
  for (const each of roles as unknown[]) {
    if (!isObject(each) || typeof each.role !== "string" || each.role === "") throw new UnsoundScoring("a role's scoring names no role");
    if (seen.has(each.role)) throw new UnsoundScoring(`the role ${showValue(each.role)} is scored twice`);
    seen.add(each.role);
    for (const side of ["bonus", "cost"] as const) validateRoleSide(each[side], `the role ${showValue(each.role)}'s ${side}`, isScorable, nameOf);
  }
}

/** A side adds up scorable stats, each once and weighed above 0, and has 1 to ROLE_BARS_MOST bars,
 *  each above 0 and above the one before. */
function validateRoleSide(side: unknown, named: string, isScorable: (stat: string) => boolean, nameOf: (stat: string) => string): void {
  if (!isObject(side) || !Array.isArray(side.parts) || side.parts.length === 0) throw new UnsoundScoring(`${named} adds up no stats`);
  const stats = new Set<string>();
  for (const part of side.parts as unknown[]) {
    if (!isObject(part) || typeof part.stat !== "string" || !isScorable(part.stat)) {
      throw new UnsoundScoring(`${named} adds ${showValue(isObject(part) ? part.stat : part)}, which is neither a catalogue stat nor one of the set's own stats`);
    }
    if (stats.has(part.stat)) throw new UnsoundScoring(`${named} adds ${nameOf(part.stat)} twice`);
    stats.add(part.stat);
    requireNumber(part.weight, `${named} weighs ${nameOf(part.stat)} at`);
    if (part.weight <= 0) throw new UnsoundScoring(`${named} weighs ${nameOf(part.stat)} at ${part.weight}, not above 0`);
  }
  if (!Array.isArray(side.bars) || side.bars.length === 0 || side.bars.length > ROLE_BARS_MOST) {
    throw new UnsoundScoring(`${named} must have 1 to ${ROLE_BARS_MOST} bars`);
  }
  let last = 0;
  for (const bar of side.bars as unknown[]) {
    requireNumber(bar, `${named} has a bar at`);
    if (bar <= last) throw new UnsoundScoring(`${named} has a bar at ${bar}, not above ${last}`);
    last = bar;
  }
}
