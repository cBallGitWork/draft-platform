import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { AREAS, LANES, positionOfSlot, SLOT_POSITIONS, type Area, type Lane } from "../../../convex/lineup/pitch";
import { priceFor, pricingOf, type ByArea, type ByPosition, type Priced } from "../../../convex/scoring/priced";
import { RULE_RUNS } from "../../support/ruleRuns";

// Rule tests on random prices (#2126): each rule is priced the same for all, by area, or by the
// position of the slot he starts in, a slot's position coming from its area and lane, left and
// right alike, never from his own positions (spec/14, How a rule scores).

const valueArb = fc.integer({ min: -20, max: 20 });
const byAreaArb: fc.Arbitrary<ByArea<number>> = fc.record(Object.fromEntries(AREAS.map((area) => [area, valueArb])) as Record<Area, fc.Arbitrary<number>>);
const byPositionArb: fc.Arbitrary<ByPosition<number>> = fc.record(
  Object.fromEntries(SLOT_POSITIONS.map((position) => [position, valueArb])) as Record<(typeof SLOT_POSITIONS)[number], fc.Arbitrary<number>>,
);
const pricedArb: fc.Arbitrary<Priced<number>> = fc.oneof(
  valueArb.map((all) => ({ all })),
  byAreaArb.map((byArea) => ({ byArea })),
  byPositionArb.map((byPosition) => ({ byPosition })),
);
const cellArb = fc.record({ area: fc.constantFrom(...AREAS), lane: fc.constantFrom(...LANES) });

/** The value `priced` gives a player starting in the slot at this cell. */
const priceAt = (priced: Priced<number>, { area, lane }: { area: Area; lane: Lane }) => priceFor(priced, area, positionOfSlot({ area, lane }));

/** The lane across the pitch from `lane`: left for right, the centre for itself. */
const mirrored = (lane: Lane) => LANES[LANES.length - 1 - LANES.indexOf(lane)];

describe("a rule's value for the slot he starts in, on random prices (spec/14)", () => {
  test("priced the same for all, every slot gets the one value", () => {
    fc.assert(
      fc.property(valueArb, cellArb, (all, cell) => {
        expect(priceAt({ all }, cell)).toBe(all);
      }),
      RULE_RUNS,
    );
  });

  test("priced by area, every slot in an area gets that area's value, whatever its lane", () => {
    fc.assert(
      fc.property(byAreaArb, cellArb, (byArea, cell) => {
        expect(priceAt({ byArea }, cell)).toBe(byArea[cell.area]);
      }),
      RULE_RUNS,
    );
  });

  test("priced by position, a slot gets its position's value, from its area and lane", () => {
    fc.assert(
      fc.property(byPositionArb, cellArb, (byPosition, cell) => {
        expect(priceAt({ byPosition }, cell)).toBe(byPosition[positionOfSlot(cell)]);
      }),
      RULE_RUNS,
    );
  });

  test("however it is priced, left and right alike", () => {
    fc.assert(
      fc.property(pricedArb, cellArb, (priced, cell) => {
        expect(priceAt(priced, { ...cell, lane: mirrored(cell.lane) })).toBe(priceAt(priced, cell));
      }),
      RULE_RUNS,
    );
  });

  test("a rule says how finely it is priced: the key it holds", () => {
    fc.assert(
      fc.property(pricedArb, (priced) => {
        expect(pricingOf(priced)).toBe(Object.keys(priced)[0]);
      }),
      RULE_RUNS,
    );
  });
});
