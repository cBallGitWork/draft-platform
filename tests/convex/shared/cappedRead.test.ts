import { describe, expect, test } from "vitest";
import { takeShown } from "../../../convex/shared/cappedRead";

const MOST = 3;
const fakeQuery = (rows: number[]) => ({ take: async (n: number) => rows.slice(0, n) });

describe("takeShown", () => {
  test("exactly the most rows: all of them, and no more", async () => {
    expect(await takeShown(fakeQuery([1, 2, 3]), MOST)).toEqual({ rows: [1, 2, 3], more: false });
  });
  test("one over the most: the first most rows, and more", async () => {
    expect(await takeShown(fakeQuery([1, 2, 3, 4]), MOST)).toEqual({ rows: [1, 2, 3], more: true });
  });
  test("fewer than the most: all of them, and no more", async () => {
    expect(await takeShown(fakeQuery([1]), MOST)).toEqual({ rows: [1], more: false });
  });
});
