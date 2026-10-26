// My team's tabs' tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { MyTeamSeam, TeamFixtures, TeamTransactions } from "../../../src/myTeam/seam";

/** What the fake server holds: the team's fixtures, null for a league with no rules, and its
 *  transactions, or nothing yet while they load. A team with no games and no transactions by
 *  default. */
export type MyTeamData = { fixtures?: TeamFixtures | null; transactions?: TeamTransactions; loading?: boolean };

export function fakeMyTeam({
  fixtures = { teamName: "Team 1", format: "headToHead", games: [] },
  transactions = { transactions: [], cut: false },
  loading = false,
}: MyTeamData = {}) {
  return {
    useTeamFixtures: vi.fn<MyTeamSeam["useTeamFixtures"]>(() => (loading ? undefined : fixtures)),
    useTeamTransactions: vi.fn<MyTeamSeam["useTeamTransactions"]>(() => (loading ? undefined : transactions)),
  };
}
