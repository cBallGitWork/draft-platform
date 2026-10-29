import { describe, expect, test } from "vitest";
import { groupedBy } from "../../../convex/shared/groupedBy";

describe("groupedBy", () => {
  test("keys come in the order first seen, each key's items in the order given", () => {
    const grouped = groupedBy(["b1", "a1", "b2", "c1", "a2"], (item) => item[0]);
    expect([...grouped]).toEqual([
      ["b", ["b1", "b2"]],
      ["a", ["a1", "a2"]],
      ["c", ["c1"]],
    ]);
  });

  test("nothing given groups into an empty map", () => {
    expect(groupedBy([], () => 0).size).toBe(0);
  });
});
