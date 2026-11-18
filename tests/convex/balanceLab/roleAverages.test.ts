import { describe, expect, test } from "vitest";
import committed from "../../support/golden/role-backtest.json";
import { ROLE_TARGETS } from "../../../convex/balanceLab/balanceLab";
import { ROLE_TARGET_MARGIN } from "../../../convex/balanceLab/balanceLabLimits";
import type { SlotPosition } from "../../../convex/lineup/pitch";
import type { RoleAverage } from "../../../convex/balanceLab/roleBacktest";

// The redrawn roles' averages over the past seasons, as the backtest last printed them on dev
// (`npx convex run balanceLab/roleBacktestRun:run`, its `averages`), committed whenever the roles or
// the seasons change (Craig, 7 Nov 2026, on #10). Empty until a session Craig watches first runs it
// (Craig, 17 Nov 2026, on #1446).

const AVERAGES: readonly RoleAverage[] = committed as RoleAverage[];

describe("the roles' committed averages", () => {
  test.each(AVERAGES.map((each) => [`${each.slot} ${each.role}`, each] as const))("S05.10 %s lands within 0.25 of its slot's target", (_, { slot, target, average }) => {
    expect(target).toBe(ROLE_TARGETS[slot as SlotPosition]);
    expect(Math.abs(average - target)).toBeLessThanOrEqual(ROLE_TARGET_MARGIN);
  });

  test("S05.10 every row names a slot with a target", () => {
    for (const { slot } of AVERAGES) expect(Object.keys(ROLE_TARGETS)).toContain(slot);
  });
});
