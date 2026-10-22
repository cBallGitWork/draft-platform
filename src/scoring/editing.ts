// The rules editor's edits to a scoring set (spec/14, How a rule scores; #30), pure: each takes a
// rule and gives the changed copy, never touching the one it was given. What makes a set sound is
// the server's (convex/scoring/scoringSet.ts), checked again when it is saved.

import { AREAS, LANES, positionOfSlot, SLOT_POSITIONS, type Area, type SlotPosition } from "../../convex/lineup/pitch";
import type { LeagueRules } from "../../convex/rules/leagueRulesShape";
import { priceFor, type Band, type Priced } from "../../convex/scoring/scoringSet";

export type Scoring = LeagueRules["scoring"];
export type Rule = Scoring["rules"][number];
export type Shape = Rule["shape"];
export type PointsLimit = { max: number | null; min: number | null };

/** The three kinds of rule, in the order the editor offers them. */
export const SHAPES = ["perAction", "perCount", "bands"] as const satisfies readonly Shape[];

/** How finely a rule is priced: the same for all, by area, or by the position of the slot. */
export type Pricing = "all" | "byArea" | "byPosition";
/** A row of a rule's prices: "all", an area or a position. */
export type PriceKey = "all" | Area | SlotPosition;

const FINENESS: Record<Pricing, number> = { all: 0, byArea: 1, byPosition: 2 };

/** Where a new per-number or band rule starts counting, and the points a new category pays: the
 *  commissioner sets both. */
const FIRST_COUNT = 1;
const NEW_POINTS = 0;
/** A points limit just ticked, neither end set; and minutes just ticked, none. */
const NO_LIMIT: PointsLimit = { max: null, min: null };
const NO_MINUTES = 0;

/** Each area's positions, wide then centre, once each (pitch.ts's `positionOfSlot`). */
const POSITIONS_OF: Record<Area, SlotPosition[]> = Object.fromEntries(
  AREAS.map((area) => [area, [...new Set(LANES.map((lane) => positionOfSlot({ area, lane })))]]),
) as Record<Area, SlotPosition[]>;

/** The area each position plays in: each is in exactly one. */
const AREA_OF = Object.fromEntries(AREAS.flatMap((area) => POSITIONS_OF[area].map((position) => [position, area]))) as Record<SlotPosition, Area>;

/** The rows a rule priced this way has. */
export function keysOf(pricing: Pricing): readonly PriceKey[] {
  return pricing === "all" ? ["all"] : pricing === "byArea" ? AREAS : SLOT_POSITIONS;
}

export function pricingOf(priced: Priced<unknown>): Pricing {
  return "all" in priced ? "all" : "byArea" in priced ? "byArea" : "byPosition";
}

/** A rule's pricing: the finest of its values', its points limit's and its minutes', which the
 *  editor shows them all at. */
export function rulePricing(rule: Rule): Pricing {
  const parts = [rule.values, rule.limit, rule.minMinutes].flatMap((part) => (part === undefined ? [] : [pricingOf(part)]));
  return parts.reduce((finest, each) => (FINENESS[each] > FINENESS[finest] ? each : finest), "all");
}

/** A priced setting's value in a row of a pricing at least as fine as its own. */
export function valueAt<Value>(priced: Priced<Value>, key: PriceKey): Value {
  if (key === "all") return priceFor(priced, AREAS[0], POSITIONS_OF[AREAS[0]][0]);
  if (isArea(key)) return priceFor(priced, key, POSITIONS_OF[key][0]);
  return priceFor(priced, AREA_OF[key], key);
}

const isArea = (key: PriceKey): key is Area => (AREAS as readonly string[]).includes(key);

/** The value most of these share, the first of them on a tie: what a coarser pricing keeps. */
function mostCommon<Value>(values: readonly Value[]): Value {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(JSON.stringify(value), (counts.get(JSON.stringify(value)) ?? 0) + 1);
  const most = Math.max(...counts.values());
  return values.find((value) => counts.get(JSON.stringify(value)) === most)!;
}

/** A priced setting at another pricing: finer copies each value down; coarser keeps the value most
 *  of each group share. */
export function reprice<Value>(priced: Priced<Value>, to: Pricing): Priced<Value> {
  const atPosition = (position: SlotPosition) => priceFor(priced, AREA_OF[position], position);
  switch (to) {
    case "all":
      return { all: mostCommon(SLOT_POSITIONS.map(atPosition)) };
    case "byArea":
      return { byArea: Object.fromEntries(AREAS.map((area) => [area, mostCommon(POSITIONS_OF[area].map(atPosition))])) as Record<Area, Value> };
    case "byPosition":
      return { byPosition: Object.fromEntries(SLOT_POSITIONS.map((position) => [position, atPosition(position)])) as Record<SlotPosition, Value> };
  }
}

/** The rule with its values, points limit and minutes all priced this way. */
export function withPricing(rule: Rule, to: Pricing): Rule {
  return {
    ...rule,
    values: reprice(rule.values as Priced<unknown>, to),
    ...(rule.limit && { limit: reprice(rule.limit, to) }),
    ...(rule.minMinutes && { minMinutes: reprice(rule.minMinutes, to) }),
  } as Rule;
}

/** A priced setting with one row changed: the setting is at the row's pricing already. */
function setAt<Value>(priced: Priced<Value>, key: PriceKey, value: Value): Priced<Value> {
  if (key === "all") return { all: value };
  if ("byArea" in priced) return { byArea: { ...priced.byArea, [key]: value } };
  if ("byPosition" in priced) return { byPosition: { ...priced.byPosition, [key]: value } };
  throw new Error(`A rule priced the same for all has no row for ${key}`);
}

/** What one row of a rule pays: a number per action, points for every so many, or bands. */
export type ValueOf<S extends Shape> = S extends "perAction" ? number : S extends "perCount" ? { every: number; points: number } : Band[];

/** The rule paying `value` in this row, all its parts priced as the row is. */
export function withValue(rule: Rule, key: PriceKey, value: ValueOf<Shape>): Rule {
  const aligned = withPricing(rule, rulePricing(rule));
  return { ...aligned, values: setAt(aligned.values as Priced<unknown>, key, value) } as Rule;
}

/** The rule's points limit in this row: `end` is "max" (at most) or "min" (at least); null is none. */
export function withLimitAt(rule: Rule, key: PriceKey, end: keyof PointsLimit, points: number | null): Rule {
  const aligned = withPricing(rule, rulePricing(rule));
  const limit = aligned.limit ?? reprice<PointsLimit>({ all: NO_LIMIT }, rulePricing(rule));
  return { ...aligned, limit: setAt(limit, key, { ...valueAt(limit, key), [end]: points }) };
}

/** The rule's minutes before it pays, in this row. */
export function withMinMinutesAt(rule: Rule, key: PriceKey, minutes: number): Rule {
  const aligned = withPricing(rule, rulePricing(rule));
  return { ...aligned, minMinutes: setAt(aligned.minMinutes ?? reprice({ all: NO_MINUTES }, rulePricing(rule)), key, minutes) };
}

/** The rule with a points limit, none yet at either end, or without one. */
export function withLimit(rule: Rule, on: boolean): Rule {
  const { limit: _dropped, ...rest } = rule;
  return on ? ({ ...rest, limit: reprice<PointsLimit>({ all: NO_LIMIT }, rulePricing(rule)) } as Rule) : (rest as Rule);
}

/** The rule paying only after so many minutes, none to begin with, or from the first minute. */
export function withMinMinutes(rule: Rule, on: boolean): Rule {
  const { minMinutes: _dropped, ...rest } = rule;
  return on ? ({ ...rest, minMinutes: reprice({ all: NO_MINUTES }, rulePricing(rule)) } as Rule) : (rest as Rule);
}

/** Whether a band rule pays every band reached, or only the highest. */
export function withStack(rule: Rule, stack: boolean): Rule {
  if (rule.shape !== "bands") throw new Error(`Only a band rule stacks, not the ${rule.stat} rule`);
  return { ...rule, stack };
}

/** The rule as another kind, each row keeping its points: per action pays them per action, per
 *  number for every so many, and bands from so many. A band rule pays only its highest band. */
export function withShape(rule: Rule, shape: Shape): Rule {
  if (shape === rule.shape) return rule;
  const { stack: _dropped, ...common } = rule as Rule & { stack?: boolean };
  const values = Object.fromEntries(
    keysOf(pricingOf(rule.values)).map((key) => [key, convert(valueAt(rule.values as Priced<ValueOf<Shape>>, key), rule.shape, shape)]),
  );
  const priced = "all" in values ? { all: values.all } : pricingOf(rule.values) === "byArea" ? { byArea: values } : { byPosition: values };
  return { ...common, shape, values: priced, ...(shape === "bands" && { stack: false }) } as Rule;
}

function convert(value: ValueOf<Shape>, from: Shape, to: Shape): ValueOf<Shape> {
  const highest = from === "bands" ? (value as Band[]).toSorted((one, other) => other.atLeast - one.atLeast)[0] : undefined;
  const points = from === "perAction" ? (value as number) : from === "perCount" ? (value as { points: number }).points : (highest?.points ?? NEW_POINTS);
  const count = from === "perCount" ? (value as { every: number }).every : (highest?.atLeast ?? FIRST_COUNT);
  if (to === "perAction") return points;
  if (to === "perCount") return { every: count, points };
  return [{ atLeast: count, points }];
}

/** How far past the highest band a new band starts. */
const NEXT_BAND_STEP = 1;

/** A band to add to these: one past the highest, paying nothing until the commissioner sets it. */
export function nextBand(bands: readonly Band[]): Band {
  const highest = Math.max(0, ...bands.map((band) => band.atLeast).filter(Number.isFinite));
  return { atLeast: highest + NEXT_BAND_STEP, points: NEW_POINTS };
}

/** A new category's rule: per action, paying nothing until the commissioner sets it. */
export const newRule = (stat: string): Rule => ({ shape: "perAction", stat, values: { all: NEW_POINTS } });

/** The index of the first rule holding a box left without a number, or -1: the server would
 *  refuse it as data of the wrong shape, never with a reason the commissioner can act on. */
export function firstBlankRule(scoring: Scoring): number {
  return scoring.rules.findIndex((rule) => holdsNaN(rule));
}

function holdsNaN(value: unknown): boolean {
  if (typeof value === "number") return Number.isNaN(value);
  if (value !== null && typeof value === "object") return Object.values(value).some(holdsNaN);
  return false;
}
