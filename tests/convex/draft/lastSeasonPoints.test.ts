import { describe, expect, test } from "vitest";
import { DUMMY_LAST_SEASON_POINTS_CSV, readPointsFile } from "../../../convex/draft/lastSeasonPoints";

// Last season's points auto-pick falls back on (#1094): dummy staging data until #1114.

describe("last season's points file", () => {
  test("reads a row a player, by FPL code, the header skipped", () => {
    expect(readPointsFile("code,points\n223340,224\n498016,-2\n")).toEqual(
      new Map([
        [223340, 224],
        [498016, -2],
      ]),
    );
  });

  test("throws on a bad line, never skipping it", () => {
    expect(() => readPointsFile("code,points\n223340,lots\n")).toThrow('bad line: "223340,lots"');
  });

  test("the dummy file reads whole, one row a player", () => {
    const lines = DUMMY_LAST_SEASON_POINTS_CSV.trim().split("\n").length - 1;
    expect(readPointsFile(DUMMY_LAST_SEASON_POINTS_CSV).size).toBe(lines);
  });
});
