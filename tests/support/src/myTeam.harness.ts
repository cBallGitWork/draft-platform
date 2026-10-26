// My team's tabs' tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { MyTeamSeam, TeamFixtures, TeamSquad, TeamTransactions } from "../../../src/myTeam/seam";

/** What the fake server holds: the team's fixtures, null for a league with no rules, and its
 *  transactions and squad, or nothing yet while they load. A team with no games, transactions or
 *  players by default. */
export type MyTeamData = { fixtures?: TeamFixtures | null; transactions?: TeamTransactions; squad?: TeamSquad; loading?: boolean };

export function fakeMyTeam({
  fixtures = { teamName: "Team 1", format: "headToHead", games: [] },
  transactions = { transactions: [], cut: false },
  squad = { teamName: "Team 1", lastGameweek: null, players: [] },
  loading = false,
}: MyTeamData = {}) {
  return {
    useTeamFixtures: vi.fn<MyTeamSeam["useTeamFixtures"]>(() => (loading ? undefined : fixtures)),
    useTeamTransactions: vi.fn<MyTeamSeam["useTeamTransactions"]>(() => (loading ? undefined : transactions)),
    useTeamSquad: vi.fn<MyTeamSeam["useTeamSquad"]>(() => (loading ? undefined : squad)),
  };
}
