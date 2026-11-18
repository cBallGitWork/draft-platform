// The table screen's tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import { leagueTableOf } from "../../../src/table/drawnTable";
import type { FixtureSwap, LeagueTable, TableSeam } from "../../../src/table/seam";
import { MY_TEAM_NAME, THEIR_TEAM_NAME } from "./teams.harness";

/** `table` as a league whose gameweeks were all played with byes before Craig dropped them (S03.4)
 *  sends it: each team drawn against the league's average sat out instead. Only the fixtures move;
 *  the table's rows are left as drawn. */
export const withByes = (table: LeagueTable): LeagueTable => ({
  ...table,
  gameweeks: table.gameweeks.map((gameweek) => ({
    ...gameweek,
    fixtures: gameweek.fixtures.filter(({ opponent }) => opponent !== null),
    byes: gameweek.fixtures.flatMap(({ team, opponent }) => (opponent === null ? [team] : [])),
  })),
});

/** What the fake server holds: the league's table, or nothing yet while it loads. Two teams' table by default. `swapAnswer` is what a fixture swap answers:
 *  null once made, or the words why not. */
export type TableData = { leagueTable?: LeagueTable; loading?: boolean; swapAnswer?: string | null };

export function fakeTable({ leagueTable = leagueTableOf([MY_TEAM_NAME, THEIR_TEAM_NAME]), loading = false, swapAnswer = null }: TableData = {}) {
  const fixtureSwap = { swap: vi.fn<FixtureSwap["swap"]>(async () => swapAnswer) };
  return { useLeagueTable: vi.fn<TableSeam["useLeagueTable"]>(() => (loading ? undefined : leagueTable)), useFixtureSwap: () => fixtureSwap, fixtureSwap };
}
