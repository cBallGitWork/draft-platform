import { describe, expect, test } from "vitest";
import { lineupProblems, STARTER_COUNT } from "../../../convex/lineup/lineup";
import { filledLineup, openLimits } from "../../support/convex/lineup.harness";
import { AREAS, LANES, type Area } from "../../../convex/lineup/pitch";
import { backLineOf, FIRST_PRESETS, type Preset } from "../../../convex/lineup/presets";

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
  "3-6-1": [
    "..X..",
    "..X..",
    ".XXX.",
    "X...X",
    ".XXX.",
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
  "2-3-5": [
    "XXXXX",
    ".....",
    ".XXX.",
    ".....",
    ".X.X.",
    "..X..",
  ],
  "2-3-2-3": [
    ".XXX.",
    ".X.X.",
    ".XXX.",
    ".....",
    ".X.X.",
    "..X..",
  ],
};

const drawn = (preset: Preset): string[] =>
  [...AREAS].reverse().map((area) =>
    LANES.map((lane) => (preset.cells.some((cell) => cell.area === area && cell.lane === lane) ? "X" : ".")).join(""),
  );

describe("the default presets", () => {
  test("are spec/05's, in its order", () => {
    expect(FIRST_PRESETS.map((preset) => preset.name)).toEqual([
      "4-4-2", "4-3-3", "4-2-3-1", "4-1-4-1", "4-4-1-1", "4-3-1-2",
      "3-5-2", "3-4-3", "3-4-1-2", "5-3-2", "5-4-1",
      "4-5-1", "4-2-2-2", "4-1-2-1-2", "4-3-2-1", "4-1-3-2", "4-2-4", "3-4-2-1", "3-1-4-2", "5-2-3", "5-3-1-1",
      "3-6-1",
      "2-3-5", "2-3-2-3",
    ]);
  });

  test.each(FIRST_PRESETS)("$name is legal under open limits, filled with players who fit", (preset) => {
    const { lineup, positions } = filledLineup(preset);

    expect(lineupProblems(lineup, positions, openLimits())).toEqual([]);
  });

  test.each(FIRST_PRESETS)("$name stands one keeper, its name's defenders and eleven in all", (preset) => {
    const inArea = (area: Area) => preset.cells.filter((cell) => cell.area === area).length;
    const defenders = Number(preset.name.split("-")[0]);

    expect([preset.cells.length, inArea("goalkeeper"), inArea("defence")]).toEqual([STARTER_COUNT, 1, defenders]);
  });

  test.each(FIRST_PRESETS)("$name stands in exactly the cells drawn for it", (preset) => {
    expect(drawn(preset)).toEqual(DRAWN[preset.name]);
  });

  test.each(FIRST_PRESETS)("$name lists its cells back to front", (preset) => {
    const areaOrder = preset.cells.map((cell) => AREAS.indexOf(cell.area));

    expect(areaOrder).toEqual([...areaOrder].sort((before, after) => before - after));
  });

  test("share no cell, so editing one preset's cell leaves every other preset as it was", () => {
    const cells = FIRST_PRESETS.flatMap((preset) => preset.cells);

    expect(new Set(cells).size).toBe(cells.length);
  });
});

// Two at the back changes base scoring for its keeper and defenders (spec/05; Craig, 4 Nov 2026:
// "clean sheets is 3, every goal conceded -1"), held with the formation as a league rule (#990).
describe("each preset's back line", () => {
  const named = (name: string) => FIRST_PRESETS.find((preset) => preset.name === name)!;

  test("is two at the back's for 2-3-5 and 2-3-2-3, and none for every other", () => {
    const withOne = FIRST_PRESETS.filter((preset) => preset.backLine !== null).map((preset) => preset.name);
    expect(withOne).toEqual(["2-3-5", "2-3-2-3"]);
    expect(named("2-3-5").backLine).toEqual({ cleanSheet: 3, goalConceded: -1 });
  });

  test("is the league's own, whatever the first values: one it edits, or takes off", () => {
    const edited = FIRST_PRESETS.map((preset) => (preset.name === "2-3-5" ? { ...preset, backLine: { cleanSheet: 2, goalConceded: -2 } } : preset));
    expect(backLineOf(named("2-3-5").cells, edited)).toEqual({ cleanSheet: 2, goalConceded: -2 });
    const dropped = FIRST_PRESETS.map((preset) => ({ ...preset, backLine: null }));
    expect(backLineOf(named("2-3-5").cells, dropped)).toBeNull();
  });

  test("of a preset held before #990 is the first for its shape, and a shape no preset is has none", () => {
    const held = FIRST_PRESETS.map(({ backLine: _backLine, ...preset }) => preset);
    expect(backLineOf(named("2-3-2-3").cells, held)).toEqual({ cleanSheet: 3, goalConceded: -1 });
    expect(backLineOf(named("4-4-2").cells, held)).toBeNull();
    expect(backLineOf(named("2-3-5").cells, [])).toBeNull();
  });
});
