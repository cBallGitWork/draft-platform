import { describe, expect, test } from "vitest";
import { inForceAt, isWaiting } from "../../../convex/scoring/siteVersions";

// The one rule for when a scoring version starts counting (#1726): exactly at its moment it is in force.
const AT = 1_000;
const EARLIER = { takesEffectAt: AT - 1 };
const EXACTLY = { takesEffectAt: AT };
const LATER = { takesEffectAt: AT + 1 };

describe("when a site scoring version counts", () => {
  test("one taking effect exactly at the moment is in force, not waiting (S14.1)", () => {
    expect(isWaiting(EXACTLY, AT)).toBe(false);
    expect(inForceAt([EARLIER, EXACTLY, LATER], AT)).toBe(EXACTLY);
  });

  test("one still to come waits, and the one before it is in force", () => {
    expect(isWaiting(LATER, AT)).toBe(true);
    expect(inForceAt([EARLIER, LATER], AT)).toBe(EARLIER);
  });

  test("before any version, none is in force", () => {
    expect(inForceAt([LATER], AT)).toBeUndefined();
  });
});
