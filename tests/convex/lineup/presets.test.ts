import { describe, expect, test } from "vitest";
import { lineupProblems, STARTER_COUNT } from "../../../convex/lineup/lineup";
import { filledLineup, openLimits } from "../../support/convex/lineup.harness";
import { AREAS, LANES, type Area } from "../../../convex/lineup/pitch";
import { DEFAULT_PRESETS, type Preset } from "../../../convex/lineup/presets";

/** Each preset as a pitch: attack at the top, the keeper at the bottom, a row's lanes left to
 *  right, X where a starter stands. */
const DRAWN: Record<string, string[]> = {
  "4-4-2": [
    ".X.X.",
    ".....",
    "XX.XX",
    ".....",
    "XX.XX",
    "..X..",
  ],
  "4-3-3": [
    "..X..",
    "X...X",
    ".XXX.",
    ".....",
    "XX.XX",
    "..X..",
  ],
  "4-2-3-1": [
    "..X..",
    "X.X.X",
    ".....",
    ".X.X.",
    "XX.XX",
    "..X..",
  ],
  "4-1-4-1": [
    "..X..",
    ".....",
    "XX.XX",
    "..X..",
    "XX.XX",
    "..X..",
  ],
  "4-4-1-1": [
    "..X..",
    "..X..",
    "XX.XX",
    ".....",
    "XX.XX",
    "..X..",
  ],
  "4-3-1-2": [
    ".X.X.",
    "..X..",
    ".XXX.",
    ".....",
    "XX.XX",
    "..X..",
  ],
  "3-5-2": [
    ".X.X.",
    ".....",
    ".XXX.",
    "X...X",
    ".XXX.",
    "..X..",
  ],
  "3-4-3": [
    "..X..",
    "X...X",
    "XX.XX",
    ".....",
    ".XXX.",
    "..X..",
  ],
  "3-4-1-2": [
    ".X.X.",
    "..X..",
    "XX.XX",
    ".....",
    ".XXX.",
    "..X..",
  ],
  "5-3-2": [
    ".X.X.",
    ".....",
    ".XXX.",
    ".....",
    "XXXXX",
    "..X..",
  ],
  "5-4-1": [
    "..X..",
    ".....",
    "XX.XX",
    ".....",
    "XXXXX",
    "..X..",
  ],
  "4-5-1": [
    "..X..",
    ".....",
    "XXXXX",
    ".....",
    "XX.XX",
    "..X..",
  ],
  "4-2-2-2": [
    ".X.X.",
    "X...X",
    ".....",
    ".X.X.",
    "XX.XX",
    "..X..",
  ],
  "4-1-2-1-2": [
    ".X.X.",
    "..X..",
    ".X.X.",
    "..X..",
    "XX.XX",
    "..X..",
  ],
  "4-3-2-1": [
    "..X..",
    ".X.X.",
    ".XXX.",
    ".....",
    "XX.XX",
    "..X..",
  ],
  "4-1-3-2": [
    ".X.X.",
    ".....",
    "X.X.X",
    "..X..",
    "XX.XX",
    "..X..",
  ],
  "4-2-4": [
    ".X.X.",
    "X...X",
    ".X.X.",
    ".....",
    "XX.XX",
    "..X..",
  ],
  "3-4-2-1": [
    "..X..",
    ".X.X.",
    "XX.XX",
    ".....",
    ".XXX.",
    "..X..",
  ],
  "3-1-4-2": [
    ".X.X.",
    ".....",
    "XX.XX",
    "..X..",
    ".XXX.",
    "..X..",
  ],
  "5-2-3": [
    "..X..",
    "X...X",
    ".X.X.",
    ".....",
    "XXXXX",
    "..X..",
  ],
  "5-3-1-1": [
    "..X..",
    "..X..",
    ".XXX.",
    ".....",
    "XXXXX",
    "..X..",
  ],
};

const drawn = (preset: Preset): string[] =>
  [...AREAS].reverse().map((area) =>
    LANES.map((lane) => (preset.cells.some((cell) => cell.area === area && cell.lane === lane) ? "X" : ".")).join(""),
  );

describe("the default presets", () => {
  test("are spec/05's twenty-one, in its order", () => {
    expect(DEFAULT_PRESETS.map((preset) => preset.name)).toEqual([
      "4-4-2", "4-3-3", "4-2-3-1", "4-1-4-1", "4-4-1-1", "4-3-1-2",
      "3-5-2", "3-4-3", "3-4-1-2", "5-3-2", "5-4-1",
      "4-5-1", "4-2-2-2", "4-1-2-1-2", "4-3-2-1", "4-1-3-2", "4-2-4", "3-4-2-1", "3-1-4-2", "5-2-3", "5-3-1-1",
    ]);
  });

  test.each(DEFAULT_PRESETS)("$name is legal under open limits, filled with players who fit", (preset) => {
    const { lineup, positions } = filledLineup(preset);

    expect(lineupProblems(lineup, positions, openLimits())).toEqual([]);
  });

  test.each(DEFAULT_PRESETS)("$name stands one keeper, its name's defenders and eleven in all", (preset) => {
    const inArea = (area: Area) => preset.cells.filter((cell) => cell.area === area).length;
    const defenders = Number(preset.name.split("-")[0]);

    expect([preset.cells.length, inArea("goalkeeper"), inArea("defence")]).toEqual([STARTER_COUNT, 1, defenders]);
  });

  test.each(DEFAULT_PRESETS)("$name stands in exactly the cells drawn for it", (preset) => {
    expect(drawn(preset)).toEqual(DRAWN[preset.name]);
  });

  test.each(DEFAULT_PRESETS)("$name lists its cells back to front", (preset) => {
    const areaOrder = preset.cells.map((cell) => AREAS.indexOf(cell.area));

    expect(areaOrder).toEqual([...areaOrder].sort((before, after) => before - after));
  });

  test("share no cell, so editing one preset's cell leaves every other preset as it was", () => {
    const cells = DEFAULT_PRESETS.flatMap((preset) => preset.cells);

    expect(new Set(cells).size).toBe(cells.length);
  });
});
