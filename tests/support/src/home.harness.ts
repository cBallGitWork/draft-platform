// League home's tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { HomeSeam, LeagueHome } from "../../../src/home/seam";

type Row = LeagueHome["table"][number];

/** A row of league home's table, at `position`, played nothing unless `rest` says. */
export const homeRow = (position: number, teamName: string, rest: Partial<Row> = {}): Row => ({
  position,
  teamId: `team-${position}` as Id<"teams">,
  teamName,
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  points: 0,
  form: [],
  mine: false,
  ...rest,
});

/** Two teams in gameweek 1, nothing scored, moved or written: what league home holds by default. */
export const quietHome: LeagueHome = {
  format: "headToHead",
  thisGameweek: { gameweek: 1, fixtures: [{ team: "Team 1", opponent: "Team 2" }], byes: [] },
  table: [homeRow(1, "Team 1", { mine: true }), homeRow(2, "Team 2")],
  teams: 2,
  squadMoves: [],
  pinnedLetter: null,
};

/** What the fake server holds: league home, null for a league with no rules, or nothing yet while
 *  it loads. */
export type HomeData = { leagueHome?: LeagueHome | null; loading?: boolean };

export function fakeHome({ leagueHome = quietHome, loading = false }: HomeData = {}) {
  return { useLeagueHome: vi.fn<HomeSeam["useLeagueHome"]>(() => (loading ? undefined : leagueHome)) };
}
