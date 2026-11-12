import { describe, expect, test } from "vitest";
import { breaksLimits } from "../../../convex/squads/limitsCompare";

// A claim against the squad's limits (#1198, spec/08), pure.

describe("a claim against the squad's limits", () => {
  const over = (players: number) => ({ kind: "overMaximum" as const, players, maximum: 15 });
  const club = (players: number) => ({ kind: "overClubMaximum" as const, clubShortName: "ARS", players, maximum: 3 });
  const area = (players: number) => ({ kind: "underAreaMinimum" as const, area: "goalkeeper" as const, players, minimum: 2 });
  const under = (players: number) => ({ kind: "underMinimum" as const, players, minimum: 13 });

  test("breaks them by a limit newly broken", () => {
    expect(breaksLimits([], [over(16)])).toBe(true);
    expect(breaksLimits([], [club(4)])).toBe(true);
    expect(breaksLimits([], [area(1)])).toBe(true);
  });

  test("breaks them by going further past one already broken", () => {
    expect(breaksLimits([over(16)], [over(17)])).toBe(true);
    expect(breaksLimits([club(4)], [club(5)])).toBe(true);
    expect(breaksLimits([area(1)], [area(0)])).toBe(true);
  });

  test("doesn't by leaving one already broken as it was, or better", () => {
    expect(breaksLimits([over(16)], [over(16)])).toBe(false);
    expect(breaksLimits([area(0)], [area(1)])).toBe(false);
    expect(breaksLimits([club(4)], [])).toBe(false);
  });

  test("a squad under its minimum size is never the claim's doing", () => {
    expect(breaksLimits([under(11)], [under(12)])).toBe(false);
  });
});
