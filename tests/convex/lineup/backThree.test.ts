import { describe, expect, test } from "vitest";
import { autoSubs } from "../../../convex/lineup/autoSubs";
import { withDroppedRoles } from "../../../convex/lineup/firstLineup";
import { plays } from "../../support/convex/autoSubs.harness";
import { FIRST_SUB, filledLineup, openLimits, presetNamed, withPositions } from "../../support/convex/lineup.harness";

// Sweeper and libero once a lineup stands (spec/05 The pitch; #989; Craig, 4 Nov 2026): offered
// only with three or more centre-backs, which a manager picks; nothing he didn't pick takes them away.

/** A 3-5-2, starters 1 to 11 in its cells' order (2, 3 and 4 the back three), the middle one on
 *  sweeper, and a bench of one holding midfielder. */
function backThreeWithSweeper() {
  const { lineup, positions } = filledLineup(presetNamed("3-5-2"));
  const starters = lineup.starters.map((starter) => (starter.area === "defence" && starter.lane === "centre" ? { ...starter, role: "sweeper" } : starter));
  return { lineup: { starters, bench: [FIRST_SUB] }, positions: withPositions(positions, FIRST_SUB, ["CDM"]) };
}

describe("a sweeper in a back three", () => {
  test("keeps his role when an auto-sub off the back three comes on in midfield, leaving two centre-backs", () => {
    const { lineup, positions } = backThreeWithSweeper();
    const absent = lineup.starters.find((starter) => starter.area === "defence" && starter.lane === "leftCentre")!;
    const result = autoSubs(lineup, positions, plays(lineup, [absent.playerCode]), openLimits(), []);
    expect(result.substitutions).toMatchObject([{ off: absent.playerCode, on: FIRST_SUB, area: "defensiveMidfield", into: "hisOwnArea" }]);
    expect(result.lineup.starters.filter((starter) => starter.area === "defence")).toHaveLength(2);
    expect(result.lineup.starters.find((starter) => starter.lane === "centre" && starter.area === "defence")?.role).toBe("sweeper");
  });

  test("picked again into a back four, the first lineup's sweeper starts on his best centre-back role instead", () => {
    const held = [{ playerCode: 3, area: "defence", lane: "centre", role: "sweeper" }] as const;
    const picked = { starters: [{ playerCode: 3, area: "defence", lane: "centre" } as const, { playerCode: 4, area: "defence", lane: "leftCentre" } as const], bench: [] };
    expect(withDroppedRoles(picked, () => [], [...held]).starters[0]).toEqual({ playerCode: 3, area: "defence", lane: "centre" });
    const three = { ...picked, starters: [...picked.starters, { playerCode: 5, area: "defence", lane: "rightCentre" } as const] };
    expect(withDroppedRoles(three, () => [], [...held]).starters[0]).toEqual(held[0]);
  });
});
