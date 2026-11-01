import { expect, test } from "vitest";
import { DEFAULT_PRESETS, presetNameOf, type Preset } from "../../../convex/lineup/presets";

// presetNameOf names the preset a side stands in, so the matchup can show its formation by its
// preset until its manager edits it (spec/10, The matchup, as a live match; #878).

const named = (name: string) => DEFAULT_PRESETS.find((preset) => preset.name === name)!;

test.each(DEFAULT_PRESETS)("$name's own cells are named $name", (preset) => {
  expect(presetNameOf(preset.cells, DEFAULT_PRESETS)).toBe(preset.name);
});

test("its cells in any order are still its name", () => {
  expect(presetNameOf(named("4-2-3-1").cells.toReversed(), DEFAULT_PRESETS)).toBe("4-2-3-1");
});

test("a shape edited off every preset has no name yet", () => {
  const edited = named("4-4-2").cells.map((cell) => (cell.area === "attack" && cell.lane === "leftCentre" ? { ...cell, lane: "centre" as const } : cell));

  expect(presetNameOf(edited, DEFAULT_PRESETS)).toBeNull();
});

test("a side short of a starter, or with one more, is no preset", () => {
  const cells = named("4-4-2").cells;

  expect(presetNameOf(cells.slice(1), DEFAULT_PRESETS)).toBeNull();
  expect(presetNameOf([...cells, { area: "attack", lane: "centre" }], DEFAULT_PRESETS)).toBeNull();
});

test("it reads the league's own presets: one it renamed by its new name, one it removed by none", () => {
  const cells = named("4-4-2").cells;
  const league: Preset[] = [{ name: "The flat four", cells }];

  expect(presetNameOf(cells, league)).toBe("The flat four");
  expect(presetNameOf(cells, DEFAULT_PRESETS.filter((preset) => preset.name !== "4-4-2"))).toBeNull();
});
