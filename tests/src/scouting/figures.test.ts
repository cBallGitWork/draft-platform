import { expect, test } from "vitest";
import { statFigure } from "../../../src/scouting/figures";

test("a stat's season total shows two decimal places at most, no trailing zeros", () => {
  expect(statFigure(3.456)).toBe("3.46");
  expect(statFigure(2.5)).toBe("2.5");
  expect(statFigure(4)).toBe("4");
});

test("an own stat's total below 0 shows the true minus, never a hyphen (#564)", () => {
  expect(statFigure(-1.5)).toBe("−1.5");
  expect(statFigure(-0.001)).toBe("0");
});
