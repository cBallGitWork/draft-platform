import { describe, expect, test } from "vitest";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { turnAfter } from "../../../convex/draft/draftRow";

// Whose pick it is from a draft's row (#1735): the one place the clock, the draft's start and the
// pick read it from.

const [a, b, c] = ["a", "b", "c"] as Id<"teams">[];

function draftRow(fields: Partial<Doc<"drafts">>): Doc<"drafts"> {
  return { _id: "draft-1" as Id<"drafts">, _creationTime: 0, leagueId: "league-1" as Id<"leagues">, ...fields };
}

describe("turnAfter", () => {
  test("no pick is on the clock before the draft starts", () => {
    expect(turnAfter(draftRow({ tradedPicks: [{ round: 1, teamId: a, ownerId: b }] }), 0)).toBeNull();
  });

  test("a traded pick puts its new owner on the clock", () => {
    const draft = draftRow({ started: { at: 0, teamIds: [a, b, c], rounds: 2 }, tradedPicks: [{ round: 2, teamId: c, ownerId: a }] });
    expect(turnAfter(draft, 3)).toEqual({ pick: 4, round: 2, team: a, via: c });
    expect(turnAfter(draft, 4)).toEqual({ pick: 5, round: 2, team: b, via: null });
  });

  test("no pick is on the clock once every pick is made", () => {
    expect(turnAfter(draftRow({ started: { at: 0, teamIds: [a, b], rounds: 1 } }), 2)).toBeNull();
  });
});
