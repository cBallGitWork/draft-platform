// The site's scoring set (spec/14, Who owns it; #354): its shape, and the check that refuses a
// bad one (spec/14, How a rule scores; each rule's checks are ruleChecks.ts's). The set is data the
// admin saves, so scoring is always handed it.

import { AREAS, type Area } from "../lineup/pitch";
import { categoryName } from "./categories";
import { validateOwnStats, type OwnStat } from "./ownStats";
import type { Priced } from "./priced";
import { requirePoints, validateRule } from "./ruleChecks";
import { CATALOGUE_STATS } from "./statCatalogue";
import { isObject, showValue, UnsoundScoring } from "./values";

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
  /** Each role's adjustment (spec/05 Roles): flat points per action, added to a starter's base
   *  points on top of every rule and its points limit (spec/14). A role it doesn't name adjusts
   *  nothing; a set with none adjusts no one. */
  roleAdjustments?: readonly RoleAdjustments[];
}

/** One role's adjustment: so many points per action of each stat, plus or minus. */
export interface RoleAdjustments {
  /** A role's key (lineup/roles.ts). */
  role: string;
  adjustments: readonly { stat: string; points: number }[];
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
  if (set.roleAdjustments !== undefined) validateRoleAdjustments(set.roleAdjustments, wholePointsOnly, isScorable, (stat) => categoryName(stat, ownStats));
}

/** Each role named once, each of its stats scorable and named once, each adjustment points. */
function validateRoleAdjustments(
  roles: unknown,
  wholePointsOnly: boolean,
  isScorable: (stat: string) => boolean,
  nameOf: (stat: string) => string,
): void {
  if (!Array.isArray(roles)) throw new UnsoundScoring("a scoring set's role adjustments must be a list");
  const seen = new Set<string>();
  for (const each of roles as unknown[]) {
    if (!isObject(each) || typeof each.role !== "string" || each.role === "") throw new UnsoundScoring("a role adjustment names no role");
    if (seen.has(each.role)) throw new UnsoundScoring(`the role ${showValue(each.role)} is adjusted twice`);
    seen.add(each.role);
    if (!Array.isArray(each.adjustments)) throw new UnsoundScoring(`the role ${showValue(each.role)} has no list of adjustments`);
    const stats = new Set<string>();
    for (const adjustment of each.adjustments as unknown[]) {
      if (!isObject(adjustment) || typeof adjustment.stat !== "string" || !isScorable(adjustment.stat)) {
        throw new UnsoundScoring(`the role ${showValue(each.role)} adjusts ${showValue(isObject(adjustment) ? adjustment.stat : adjustment)}, which is neither a catalogue stat nor one of the set's own stats`);
      }
      if (stats.has(adjustment.stat)) throw new UnsoundScoring(`the role ${showValue(each.role)} adjusts ${nameOf(adjustment.stat)} twice`);
      stats.add(adjustment.stat);
      requirePoints(adjustment.points, `the role ${showValue(each.role)}'s ${nameOf(adjustment.stat)} adjustment is worth`, wholePointsOnly);
    }
  }
}
