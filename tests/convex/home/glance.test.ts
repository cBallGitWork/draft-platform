import { describe, expect, test } from "vitest";
import { shownRows, thisGameweekOf, TOP_ROWS, WHOLE_TABLE_MOST } from "../../../convex/home/glance";

// What league home picks out of the fixtures and the table (spec/12, League home): this gameweek,
// and the rows shown.

describe("this gameweek", () => {
  const gameweeks = [{ gameweek: 3 }, { gameweek: 4 }, { gameweek: 6 }];
  const deadlineOf = (gameweek: number) => gameweek * 100;

  test.each([
    ["before any has begun, the first to come", 0, 3],
    ["at a deadline, the gameweek it begins", 400, 4],
    ["between deadlines, the latest begun", 599, 4],
    ["once all have begun, the last", 10_000, 6],
  ])("%s", (_, now, expected) => {
    expect(thisGameweekOf(gameweeks, deadlineOf, now)?.gameweek).toBe(expected);
  });

  test("a gameweek with no deadline yet hasn't begun", () => {
    expect(thisGameweekOf(gameweeks, (gameweek) => (gameweek === 3 ? 100 : null), 10_000)?.gameweek).toBe(3);
  });

  test("with no head-to-head gameweeks there is none", () => {
    expect(thisGameweekOf([], deadlineOf, 0)).toBeUndefined();
  });
});

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
