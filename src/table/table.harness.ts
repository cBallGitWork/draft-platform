// The table screen's tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import { leagueTableOf } from "./drawnTable";
import type { LeagueTable, TableSeam } from "./seam";

/** What the fake server holds: the league's table, null for a league with no rules, or nothing
 *  yet while it loads. Two teams' table by default. */
export type TableData = { leagueTable?: LeagueTable | null; loading?: boolean };

export function fakeTable({ leagueTable = leagueTableOf(["Team 1", "Team 2"]), loading = false }: TableData = {}) {
  return { useLeagueTable: vi.fn<TableSeam["useLeagueTable"]>(() => (loading ? undefined : leagueTable)) };
}
