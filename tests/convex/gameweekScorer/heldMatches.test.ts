import { expect, test } from "vitest";
import type { Doc } from "../../../convex/_generated/dataModel";
import { isPostponed } from "../../../convex/gameweekScorer/heldMatches";

// S05.4
test("a match with no kickoff time is postponed, one rearranged with a kickoff in the gameweek isn't (#900)", () => {
  const match = (kickoff: number | null) => ({ fixture: { kickoff } as Doc<"fixtures"> });
  expect(isPostponed(match(null))).toBe(true);
  expect(isPostponed(match(1_700_000_000_000))).toBe(false);
});
