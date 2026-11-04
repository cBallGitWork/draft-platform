import { expect, test } from "vitest";
import { lineupProblems } from "../../../convex/lineup/lineup";
import { sameCell } from "../../../convex/lineup/pitch";
import { DEFAULT_PRESETS } from "../../../convex/lineup/presets";
import { SWEEPER_CELL } from "../../../convex/lineup/roles";
import { filledLineup, openLimits } from "../../support/convex/lineup.harness";

// A preset can set the starting role of the defence's centre cell: that is what makes 5(SW)-3-2
// and 3(L)-5-2 their own presets (spec/05, The pitch; Craig, 4 Nov 2026; #988).

const withCentreRole = DEFAULT_PRESETS.filter(({ centreRole }) => centreRole !== undefined);

test("5(SW)-3-2 starts its defence's centre on the sweeper role, 3(L)-5-2 on the libero, and no other sets one", () => {
  expect(withCentreRole.map(({ name, centreRole }) => [name, centreRole])).toEqual([
    ["5(SW)-3-2", "sweeper"],
    ["3(L)-5-2", "libero"],
  ]);
});

test.each(withCentreRole)("$name is legal under open limits with its centre on its role", (preset) => {
  const { lineup, positions } = filledLineup(preset);
  const starters = lineup.starters.map((starter) => (sameCell(starter, SWEEPER_CELL) ? { ...starter, role: preset.centreRole } : starter));

  expect(starters.filter(({ role }) => role !== undefined)).toHaveLength(1);
  expect(lineupProblems({ ...lineup, starters }, positions, openLimits())).toEqual([]);
});
