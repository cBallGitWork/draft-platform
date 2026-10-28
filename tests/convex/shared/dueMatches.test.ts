import { expect, test } from "vitest";
import { byGameweek } from "../../../convex/shared/dueMatches";

// The due matches grouped by gameweek, which both the stats sync and the team-sheet read walk.

test("groups the due matches by gameweek, each gameweek's in the order given", () => {
  const due = [
    { fixtureCode: 30, gameweek: 7 },
    { fixtureCode: 10, gameweek: 6 },
    { fixtureCode: 20, gameweek: 7 },
  ];
  expect([...byGameweek(due)]).toEqual([
    [7, [30, 20]],
    [6, [10]],
  ]);
});

test("no due matches give no gameweeks", () => {
  expect(byGameweek([]).size).toBe(0);
});
