import { v, type Validator } from "convex/values";
import { AREAS, LANES } from "./pitch";

// The pitch's validators: an area, a cell, and the same validator for each area. League rules,
// the site's scoring set, squads and matchups each store one, so they live with the pitch.

/** A validator for a field that must be there. */
export type RequiredValidator = Validator<unknown, "required", string>;

/** The same validator under each of `keys`, in their order. The one cast names the exact keys
 *  `Object.fromEntries` loses; it narrows the type and loosens nothing. */
export function objectOf<Key extends string, Value extends RequiredValidator>(keys: readonly Key[], value: Value) {
  return v.object(Object.fromEntries(keys.map((key) => [key, value])) as Record<Key, Value>);
}

/** The same validator for each of the pitch's six areas: a ByArea<Value>, or a Record<Area, …>. */
export function byArea<Value extends RequiredValidator>(value: Value) {
  return objectOf(AREAS, value);
}

/** One of the pitch's six areas. */
export const areaShape = v.union(...AREAS.map((name) => v.literal(name)));
const lane = v.union(...LANES.map((name) => v.literal(name)));
/** One cell of the pitch: pitch.ts's Cell. */
export const cellShape = v.object({ area: areaShape, lane });
