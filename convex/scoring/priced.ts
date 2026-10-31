// How finely a scoring rule's value is set, and the value it gives the slot he starts in (spec/14).
// Apart from scoringSet.ts so the rules editor in the browser can price a value without loading
// the scoring set's checks (#756). It imports only the pitch's types.

import type { Area, SlotPosition } from "../lineup/pitch";

/** A value for each of the six areas. */
export type ByArea<Value> = Readonly<Record<Area, Value>>;

/** A value for each position a slot can be (../lineup/pitch.ts, `positionOfSlot`). */
export type ByPosition<Value> = Readonly<Record<SlotPosition, Value>>;

/** How finely a rule's value is set (spec/14): the same for all, by area, or by the position of
 *  the slot he starts in. */
export type Priced<Value> = { all: Value } | { byArea: ByArea<Value> } | { byPosition: ByPosition<Value> };

/** The value a priced setting gives the slot he starts in. */
export function priceFor<Value>(priced: Priced<Value>, area: Area, position: SlotPosition): Value {
  if ("all" in priced) return priced.all;
  if ("byArea" in priced) return priced.byArea[area];
  return priced.byPosition[position];
}
