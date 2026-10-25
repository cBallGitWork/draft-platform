import { isLocked } from "../gameweeks/deadline";

// What league home picks out of the league's fixtures and table (spec/12, League home: "the
// glance"). Pure, so the preview and the tests pick the same way.
// Each number is Craig's, from the grill of 25 Oct 2026.

/** A table of up to this many teams is shown whole on league home. */
export const WHOLE_TABLE_MOST = 10;
/** Past WHOLE_TABLE_MOST, league home shows this many from the top, and the manager's own row. */
export const TOP_ROWS = 5;
/** How many of the league's latest claims, drops and trades league home lists. */
export const TICKER_MOST = 5;

/** The gameweek league home shows the head-to-heads of: the latest the league has begun, by its own
 *  deadlines, or before any has, the first to come. Undefined with no head-to-head gameweeks. */
export function thisGameweekOf<Gameweek extends { gameweek: number }>(
  gameweeks: readonly Gameweek[],
  deadlineOf: (gameweek: number) => number | null,
  now: number,
): Gameweek | undefined {
  return gameweeks.findLast(({ gameweek }) => isLocked(deadlineOf(gameweek), now)) ?? gameweeks[0];
}

/** The table's rows league home shows, each with its place in the whole table: every row up to
 *  WHOLE_TABLE_MOST teams; past it, the top TOP_ROWS and the row of `mine`, the manager's team. */
export function shownRows<Row extends { teamId: string }>(table: readonly Row[], mine: string | null): (Row & { position: number })[] {
  const placed = table.map((row, index) => ({ ...row, position: index + 1 }));
  if (placed.length <= WHOLE_TABLE_MOST) return placed;
  return placed.filter((row) => row.position <= TOP_ROWS || row.teamId === mine);
}
