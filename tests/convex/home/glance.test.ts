import { describe, expect, test } from "vitest";
import { shownRows, TOP_ROWS, WHOLE_TABLE_MOST } from "../../../convex/home/glance";

// What league home picks out of the table (spec/12, League home): the rows shown. Which is this
// gameweek is tested beside the next gameweek, in tests/convex/gameweeks/nextGameweek.test.ts.

describe("the rows shown", () => {
  const tableOf = (teams: number) => Array.from({ length: teams }, (_, i) => ({ teamId: `team-${i + 1}` }));
  const positions = (rows: { position: number }[]) => rows.map((row) => row.position);

  test(`up to ${WHOLE_TABLE_MOST} teams, every row, placed`, () => {
    expect(positions(shownRows(tableOf(WHOLE_TABLE_MOST), null))).toEqual(Array.from({ length: WHOLE_TABLE_MOST }, (_, i) => i + 1));
  });

  test(`past ${WHOLE_TABLE_MOST}, the top ${TOP_ROWS} and the manager's row`, () => {
    expect(positions(shownRows(tableOf(WHOLE_TABLE_MOST + 1), "team-8"))).toEqual([1, 2, 3, 4, 5, 8]);
  });

  test("a manager in the top rows adds no row", () => {
    expect(positions(shownRows(tableOf(WHOLE_TABLE_MOST + 1), "team-2"))).toEqual([1, 2, 3, 4, 5]);
  });
});
