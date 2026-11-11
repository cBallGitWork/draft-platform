// A player's points for one match under a scoring set (spec/14, How a rule scores; #29): the
// site's in force that gameweek (siteVersions.ts), data the admin saves, so always an argument.

import { MINUTES_STAT } from "../stats/matchRecords";
import { withOwnStats } from "./ownStats";
import { AREAS, LANES, positionOfSlot, type Cell, type SlotPosition } from "../lineup/pitch";
import { priceFor, pricingOf, type Priced } from "./priced";
import { validateScoringSet, type Area, type Band, type RoleSide, type ScoringRule, type ScoringSet } from "./scoringSet";
import { backLineAt, instructionPoints, withBackLine, type InstructionPoints, type TeamScoring } from "./teamScoring";
import { DOUBLE_GAMEWEEK_RULES, inTenths, showValue, statIn, weighedCount, type DoubleGameweekRule, type MatchStats } from "./values";

export type { InstructionPoints, TeamScoring };

/** One category's points, with why he earned them, or null ("—") while his record for the match
 *  hasn't arrived (spec/14, On screen: each line of a breakdown says why). */
export type CategoryPoints = { stat: string; points: null } | { stat: string; points: number; why: CategoryWhy };

/** Why a category gave his points: how many of its stat he made, the rule's value for the slot he
 *  was scored in and how finely the rule sets it, and what cut it, if anything. His points are
 *  the value's for those actions, unless cut. */
export interface CategoryWhy {
  actions: number;
  value: SlotValue;
  pricedBy: PricedBy;
  cut: Cut | null;
}

/** The rule's value at his slot: so many points an action; so many for each whole `every`; or,
 *  for a band rule, the bands he earned (each he reached when it stacks, else his highest). */
export type SlotValue =
  | { shape: "perAction"; points: number }
  | { shape: "perCount"; every: number; points: number }
  | { shape: "bands"; earned: Band[] };

/** How finely the rule sets its value (spec/14): the same for all, by his slot's area, or by its
 *  position; or his team's formation set it, as two at the back's back line does (#990). */
export type PricedBy = { by: "all" } | { by: "area"; area: Area } | { by: "position"; position: SlotPosition } | { by: "formation"; formation: string };

/** What changed his points from the value's: he played fewer minutes than the rule needs, so it
 *  gave nothing; or its points limit held them to its most or its least. Or, though it changed
 *  nothing, his points landed exactly on its most or its least, so the line says he reached it
 *  (spec/14, On screen; Craig, 1 Nov 2026, #863). */
export type Cut = { by: "minutes"; atLeast: number } | { by: "max" | "min" | "atMax" | "atMin"; limit: number };

/** A player's match: each rule's category in the set's order, and their total, null with them. */
export interface MatchPoints {
  total: number | null;
  categories: CategoryPoints[];
  /** His role's points, in the total, when the set scores the role he played (spec/05: "Poacher:
   *  +1 (+2: 1 goal in box, 1 shot on target in box; −1: 1 big chance missed)"). Absent when no
   *  role was given or the set scores none. */
  role?: RolePoints;
  /** Each of his team's instructions the set scores, in the order the team's are given, each its
   *  own line under his role's (spec/05: "Park the bus: clean sheet +1"). Absent when no
   *  instruction was given or the set scores none of them. */
  instructions?: InstructionPoints[];
}

/** A role's points in a match: its bonus less its cost, each at most ROLE_BARS_MOST. */
export interface RolePoints {
  /** A role's key (lineup/roles.ts). */
  role: string;
  points: number;
  /** Each side that moved his points, bonus first: what it gave, +2 or −1, and each of its stats he
   *  made, by how many he made. */
  sides: RoleSidePoints[];
}

export interface RoleSidePoints {
  side: "bonus" | "cost";
  points: number;
  lines: { stat: string; actions: number }[];
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
export function scoreMatch(record: MatchStats | null, set: ScoringSet, cell: Cell, role?: string, team?: TeamScoring): MatchPoints {
  checkedOnce(set);
  if (!AREAS.includes(cell.area)) throw new Error(`${showValue(cell.area)} is not one of the pitch's six areas`);
  if (!LANES.includes(cell.lane)) throw new Error(`${showValue(cell.lane)} is not one of the pitch's five lanes`);
  if (record === null) {
    return { total: null, categories: set.rules.map((rule) => ({ stat: rule.stat, points: null })) };
  }
  const slot = { area: cell.area, position: positionOfSlot(cell) };
  record = withOwnStats(record, set);
  const minutes = statIn(record, MINUTES_STAT);
  const backLine = backLineAt(team, slot.area);
  const categories = set.rules.map((each) => {
    const rule = backLine === null ? each : withBackLine(each, backLine.scoring);
    const actions = statIn(record, rule.stat);
    const { points, value, cut } = ruleScore(rule, slot, actions, minutes);
    const by = rule === each ? pricedBy(rule.values, slot) : { by: "formation" as const, formation: backLine!.formation };
    return { stat: rule.stat, points, why: { actions, value, pricedBy: by, cut } };
  });
  const base = sum(categories.map((category) => category.points));
  const adjusted = role === undefined ? undefined : rolePoints(record, set, role);
  const instructed = (team?.instructions ?? []).flatMap((key) => instructionPoints(record, set, key, slot.position, minutes) ?? []);
  const total = inTenths(base + (adjusted?.points ?? 0) + sum(instructed.map(({ points }) => points)));
  return { total, categories, ...(adjusted !== undefined && { role: adjusted }), ...(instructed.length > 0 && { instructions: instructed }) };
}

/** Sets already checked, by the object read: a page of players scores every match under one set,
 *  and checking it was nine tenths of the time (#1574). A set read is never changed after. */
const CHECKED_SETS = new WeakSet<ScoringSet>();

function checkedOnce(set: ScoringSet): void {
  if (CHECKED_SETS.has(set)) return;
  validateScoringSet(set);
  CHECKED_SETS.add(set);
}

/** What `role` gives a man with this record under `set`, own stats worked out: 0 for no role, or
 *  one the set doesn't score. What a threshold line adds for his role (vidiprinter.ts). */
export function roleTotal(record: MatchStats, set: ScoringSet, role: string | undefined): number {
  if (role === undefined) return 0;
  return rolePoints(withOwnStats(record, set), set, role)?.points ?? 0;
}

/** The role's points for this record (spec/05 Roles): whole points by bars, never per action, on
 *  top of every rule and its points limit (spec/14), whatever his minutes (Craig, 5 Nov 2026: bars
 *  count per match, a cameo's too). Undefined when the set doesn't score the role. */
function rolePoints(record: MatchStats, set: ScoringSet, role: string): RolePoints | undefined {
  const scoring = set.roles?.find((each) => each.role === role);
  if (scoring === undefined) return undefined;
  const bonus = sidePoints(record, scoring.bonus, "bonus");
  const cost = sidePoints(record, scoring.cost, "cost");
  const sides = [bonus, cost].filter((side) => side.points !== 0);
  return { role, points: bonus.points + cost.points, sides };
}

/** A side's points: one for each of its bars his weighed count reaches, plus for the bonus and
 *  minus for the cost, with each of its stats he made. */
function sidePoints(record: MatchStats, { parts, bars }: RoleSide, side: RoleSidePoints["side"]): RoleSidePoints {
  const count = weighedCount(record, parts);
  const reached = bars.filter((bar) => count >= bar).length;
  const lines = parts.map(({ stat }) => ({ stat, actions: statIn(record, stat) })).filter(({ actions }) => actions !== 0);
  return { side, points: side === "bonus" ? reached : -reached || 0, lines };
}

/** A rule's points for the slot, with its value there and what cut them: nothing below its
 *  minimum minutes, else held to its points limit, or marked as reaching it exactly. Points too
 *  large to be a number throw. */
function ruleScore(rule: ScoringRule, slot: Slot, actions: number, minutes: number): { points: number; value: SlotValue; cut: Cut | null } {
  const price: Price = (priced) => priceFor(priced, slot.area, slot.position);
  const value = valueAt(rule, price, actions);
  const uncut = inTenths(valuePoints(value, actions));
  let points = uncut;
  let cut: Cut | null = null;
  const atLeast = rule.minMinutes === undefined ? undefined : price(rule.minMinutes);
  if (atLeast !== undefined && minutes < atLeast) {
    points = 0;
    if (uncut !== 0) cut = { by: "minutes", atLeast };
  } else if (rule.limit !== undefined) {
    const { max, min } = price(rule.limit);
    if (max !== null && points > max) [points, cut] = [max, { by: "max", limit: max }];
    if (min !== null && points < min) [points, cut] = [min, { by: "min", limit: min }];
    // Landing on a limit of 0 with nothing earned isn't reaching it: no line for every man without the stat.
    if (cut === null && points !== 0 && points === max) cut = { by: "atMax", limit: max };
    if (cut === null && points !== 0 && points === min) cut = { by: "atMin", limit: min };
  }
  if (!Number.isFinite(points)) throw new Error(`the ${rule.stat} rule gives ${points} points as ${slot.position}`);
  return { points: inTenths(points), value, cut };
}

/** One rule's points for a man priced at `cell`, with `actions` of its stat and `minutes` played:
 *  what a threshold line prices its step by (stats/thresholdSteps.ts). A bad cell is the caller's
 *  to check. */
export function rulePointsIn(rule: ScoringRule, cell: Cell, actions: number, minutes: number): number {
  return ruleScore(rule, { area: cell.area, position: positionOfSlot(cell) }, actions, minutes).points;
}

/** A rule's setting for the slot being scored. */
type Price = <Value>(priced: Priced<Value>) => Value;

function pricedBy(values: Priced<unknown>, slot: Slot): PricedBy {
  switch (pricingOf(values)) {
    case "all":
      return { by: "all" };
    case "byArea":
      return { by: "area", area: slot.area };
    case "byPosition":
      return { by: "position", position: slot.position };
  }
}

/** The rule's value at the slot: for a band rule, the bands he earned of it. */
function valueAt(rule: ScoringRule, price: Price, actions: number): SlotValue {
  switch (rule.shape) {
    case "perAction":
      return { shape: "perAction", points: price(rule.values) };
    case "perCount": {
      const { every, points } = price(rule.values);
      return { shape: "perCount", every, points };
    }
    case "bands":
      return { shape: "bands", earned: earnedBands(price(rule.values), rule.stack, actions) };
  }
}

/** The points a value gives for `actions`, before any cut. */
function valuePoints(value: SlotValue, actions: number): number {
  switch (value.shape) {
    case "perAction":
      return actions * value.points;
    case "perCount":
      return Math.floor(actions / value.every) * value.points;
    case "bands":
      return sum(value.earned.map((band) => band.points));
  }
}

/** Each band he reached when the rule stacks, else only his highest. */
function earnedBands(bands: readonly Band[], stack: boolean, actions: number): Band[] {
  const reached = bands.filter((band) => actions >= band.atLeast).map(({ atLeast, points }) => ({ atLeast, points }));
  if (stack) return reached;
  const highest = reached.toSorted((one, other) => other.atLeast - one.atLeast)[0];
  return highest === undefined ? [] : [highest];
}

function sum(numbers: readonly number[]): number {
  return numbers.reduce((total, each) => total + each, 0);
}

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
