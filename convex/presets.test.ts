import { describe, expect, test } from "vitest";
import { lineupProblems, STARTERS } from "./lineup";
import { filledLineup, openLimits } from "./lineup.harness";
import { DEFAULT_PRESETS } from "./presets";

describe("the default presets", () => {
  test("are spec/05's eleven, in its order", () => {
    expect(DEFAULT_PRESETS.map((preset) => preset.name)).toEqual([
      "4-4-2", "4-3-3", "4-2-3-1", "4-1-4-1", "4-4-1-1", "4-3-1-2",
      "3-5-2", "3-4-3", "3-4-1-2", "5-3-2", "5-4-1",
    ]);
  });

  test.each(DEFAULT_PRESETS)("$name is legal under open limits, filled with players who fit", (preset) => {
    const { lineup, positions } = filledLineup(preset);

    expect(lineupProblems(lineup, positions, openLimits())).toEqual([]);
  });

  test.each(DEFAULT_PRESETS)("$name stands one keeper, its name's defenders and eleven in all", (preset) => {
    const inArea = (area: string) => preset.cells.filter((cell) => cell.area === area).length;
    const defenders = Number(preset.name.split("-")[0]);

    expect([preset.cells.length, inArea("goalkeeper"), inArea("defence")]).toEqual([STARTERS, 1, defenders]);
  });
});
