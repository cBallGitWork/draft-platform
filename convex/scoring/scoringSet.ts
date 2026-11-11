// The site's scoring set (spec/14, Who owns it; #354): its shape, and the check that refuses a
// bad one (spec/14, How a rule scores; each rule's checks are ruleChecks.ts's). The set is data the
// admin saves, so scoring is always handed it.

import { AREAS, SLOT_POSITIONS, type Area, type SlotPosition } from "../lineup/pitch";
import { categoryName } from "./categories";
import { validateOwnStats, type OwnStat } from "./ownStats";
import type { Priced } from "./priced";
import { validateRule } from "./ruleChecks";
import { CATALOGUE_STATS } from "./statCatalogue";
import { isObject, requireNumber, showValue, UnsoundScoring, type WeighedStat } from "./values";

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
interface PerActionRule extends RuleOptions {
  shape: "perAction";
  stat: string;
  values: Priced<number>;
}

/** +1 per 3 saves: the points for each whole `every` actions he made. */
interface PerCountRule extends RuleOptions {
  shape: "perCount";
  stat: string;
  values: Priced<{ every: number; points: number }>;
}

/** 2 for 60+ minutes, +2 for 10+ defensive actions: he earns each band he reaches when the rule
 *  stacks, or only the highest he reaches when it doesn't. A slot with no bands earns nothing. */
interface BandsRule extends RuleOptions {
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
  /** Each team instruction's scoring (spec/05 Team instructions; #990): whole points, added to the
   *  points of a man whose team picked it, on top of every rule and his role. An instruction it
   *  doesn't name scores nothing; a set with none scores no instruction. */
  instructions?: readonly InstructionScoring[];
}

/** One team instruction's scoring (spec/05 Team instructions): its lines, each scored apart. */
export interface InstructionScoring {
  /** An instruction's key (lineup/instructions.ts). */
  instruction: string;
  lines: readonly InstructionLine[];
}

/** One line of an instruction, such as Park the bus's "GK/DEF clean sheet +1": its stats, each
 *  weighed and added up into a count as a role's side's are, and `points` for each whole `every`
 *  of it, in whole points (spec/05: "whole points by thresholds"). */
export interface InstructionLine {
  /** The slots it scores, by the position each stands for (Craig, 9 Nov 2026, on #990: "keeper,
   *  full-back, centre-back and wing-back slots are GK/DEF"); absent for every slot. */
  positions?: readonly SlotPosition[];
  stats: readonly WeighedStat[];
  every: number;
  points: number;
  /** The most points it gives either way in a match, as Hold a high line's "up to 3". */
  most?: number;
  /** The minutes he must play before it gives anything: a clean sheet's 60, as in base scoring. */
  minMinutes?: number;
}

/** The most bars a side of a role has, so a role moves a match by at most 3 either way (spec/05:
 *  "±3, chosen over ±2", Craig, 5 Nov 2026). */
export const ROLE_BARS_MOST = 3;

/** One side of a role: its stats, each weighed (2 × goals, ½ recoveries, accurate passes ÷ 10),
 *  added up into a count, and its bars, rising: the count gives a point at each it reaches. */
export interface RoleSide {
  parts: readonly WeighedStat[];
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
  if (set.instructions !== undefined) validateInstructions(set.instructions, isScorable, (stat) => categoryName(stat, ownStats));
}

/** Each instruction named once, with at least one line, each sound. */
function validateInstructions(instructions: unknown, isScorable: (stat: string) => boolean, nameOf: (stat: string) => string): void {
  if (!Array.isArray(instructions)) throw new UnsoundScoring("a scoring set's instructions must be a list");
  const seen = new Set<string>();
  for (const each of instructions as unknown[]) {
    if (!isObject(each) || typeof each.instruction !== "string" || each.instruction === "") {
      throw new UnsoundScoring("an instruction's scoring names no instruction");
    }
    const named = `the instruction ${showValue(each.instruction)}`;
    if (seen.has(each.instruction)) throw new UnsoundScoring(`${named} is scored twice`);
    seen.add(each.instruction);
    if (!Array.isArray(each.lines) || each.lines.length === 0) throw new UnsoundScoring(`${named} has no lines`);
    (each.lines as unknown[]).forEach((line, index) => validateInstructionLine(line, `${named}'s line ${index + 1}`, isScorable, nameOf));
  }
}

/** A line adds up scorable stats as a role's side does, gives whole points other than 0 for each
 *  whole `every` above 0, and names only slots' positions, and a whole most above 0. */
function validateInstructionLine(line: unknown, named: string, isScorable: (stat: string) => boolean, nameOf: (stat: string) => string): void {
  if (!isObject(line)) throw new UnsoundScoring(`${named} is not a line`);
  validateParts(line.stats, named, isScorable, nameOf);
  requireNumber(line.every, `${named} counts every`);
  if (line.every <= 0) throw new UnsoundScoring(`${named} counts every ${line.every}, not above 0`);
  requireNumber(line.points, `${named} gives`);
  if (!Number.isInteger(line.points) || line.points === 0) throw new UnsoundScoring(`${named} gives ${line.points}, not whole points other than 0`);
  if (line.most !== undefined) {
    requireNumber(line.most, `${named} gives at most`);
    if (!Number.isInteger(line.most) || line.most <= 0) throw new UnsoundScoring(`${named} gives at most ${line.most}, not a whole number above 0`);
  }
  if (line.minMinutes !== undefined) {
    requireNumber(line.minMinutes, `${named} needs minutes of`);
    if (line.minMinutes < 0) throw new UnsoundScoring(`${named} needs ${line.minMinutes} minutes, below 0`);
  }
  if (line.positions !== undefined) {
    if (!Array.isArray(line.positions) || line.positions.length === 0) throw new UnsoundScoring(`${named} scores no slot`);
    for (const position of line.positions as unknown[]) {
      if (!SLOT_POSITIONS.includes(position as SlotPosition)) throw new UnsoundScoring(`${named} scores ${showValue(position)}, which is no slot's position`);
    }
  }
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
  if (!isObject(side)) throw new UnsoundScoring(`${named} adds up no stats`);
  validateParts(side.parts, named, isScorable, nameOf);
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

/** A count's stats: scorable, each once and weighed above 0. A role's side and an instruction's
 *  line add theirs up alike. */
function validateParts(parts: unknown, named: string, isScorable: (stat: string) => boolean, nameOf: (stat: string) => string): void {
  if (!Array.isArray(parts) || parts.length === 0) throw new UnsoundScoring(`${named} adds up no stats`);
  const stats = new Set<string>();
  for (const part of parts as unknown[]) {
    if (!isObject(part) || typeof part.stat !== "string" || !isScorable(part.stat)) {
      throw new UnsoundScoring(`${named} adds ${showValue(isObject(part) ? part.stat : part)}, which is neither a catalogue stat nor one of the set's own stats`);
    }
    if (stats.has(part.stat)) throw new UnsoundScoring(`${named} adds ${nameOf(part.stat)} twice`);
    stats.add(part.stat);
    requireNumber(part.weight, `${named} weighs ${nameOf(part.stat)} at`);
    if (part.weight <= 0) throw new UnsoundScoring(`${named} weighs ${nameOf(part.stat)} at ${part.weight}, not above 0`);
  }
}
