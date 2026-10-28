// What league home picks out of the league's table (spec/12, League home: "the glance"); which is
// this gameweek is nextGameweek.ts's `thisGameweekOf`. Pure, so the preview and the tests pick the
// same way.
// Each number is Craig's, from the grill of 25 Oct 2026.

/** A table of up to this many teams is shown whole on league home. */
export const WHOLE_TABLE_MOST = 10;
/** Past WHOLE_TABLE_MOST, league home shows this many from the top, and the manager's own row. */
export const TOP_ROWS = 5;
/** How many of the league's latest claims, drops and trades league home lists. */
export const TICKER_MOST = 5;

/** The table's rows league home shows, each with its place in the whole table: every row up to
 *  WHOLE_TABLE_MOST teams; past it, the top TOP_ROWS and the row of `mine`, the manager's team. */
export function shownRows<Row extends { teamId: string }>(table: readonly Row[], mine: string | null): (Row & { position: number })[] {
  const placed = table.map((row, index) => ({ ...row, position: index + 1 }));
  if (placed.length <= WHOLE_TABLE_MOST) return placed;
  return placed.filter((row) => row.position <= TOP_ROWS || row.teamId === mine);
}
