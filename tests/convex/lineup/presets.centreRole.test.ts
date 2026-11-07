import { expect, test } from "vitest";
import { DEFAULT_PRESETS } from "../../../convex/lineup/presets";

// Sweeper and libero are centre-back roles only: the 5(SW)-3-2 and 3(L)-5-2 presets, and a
// preset's starting role for the defence's centre, are dropped (spec/05, The pitch; Craig,
// 5 Nov 2026: "we made sweeper a role and liberio, ditched sweeper formations"; #1159).

test("no default preset is a sweeper or libero formation, and none sets a role", () => {
  expect(DEFAULT_PRESETS.map(({ name }) => name).filter((name) => name.includes("("))).toEqual([]);
  // Its default team instructions (#990) are all a preset holds besides its shape.
  expect(DEFAULT_PRESETS.every((preset) => Object.keys(preset).sort().join() === "cells,instructions,name")).toBe(true);
});
