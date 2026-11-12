import { describe, expect, test } from "vitest";
import { matched } from "../../../convex/shared/matching";

/** Who can take which seat, by name. */
const seatsOf = (seats: Record<string, string[]>) => (left: string) => seats[left] ?? [];
const bySeat = (seat: string) => seat;

describe("matched", () => {
  test("as many matched as can be, an earlier one moved to make room for a later", () => {
    const match = matched(["ann", "bob"], seatsOf({ ann: ["a", "b"], bob: ["a"] }), bySeat);
    expect([...match]).toEqual([
      ["ann", "b"],
      ["bob", "a"],
    ]);
  });

  test("one with no seat left is left out, never one placed earlier", () => {
    const match = matched(["ann", "bob"], seatsOf({ ann: ["a"], bob: ["a"] }), bySeat);
    expect([...match]).toEqual([["ann", "a"]]);
  });

  test("in order, a held seat is tried before a later open one; open first takes the open one", () => {
    const seats = seatsOf({ ann: ["a", "b"], bob: ["a", "b"] });
    expect(matched(["ann", "bob"], seats, bySeat)).toEqual(
      new Map([
        ["ann", "b"],
        ["bob", "a"],
      ]),
    );
    expect(matched(["ann", "bob"], seats, bySeat, "openFirst")).toEqual(
      new Map([
        ["ann", "a"],
        ["bob", "b"],
      ]),
    );
  });

  test("nothing given matches nothing", () => {
    expect(matched([], seatsOf({}), bySeat).size).toBe(0);
  });
});
