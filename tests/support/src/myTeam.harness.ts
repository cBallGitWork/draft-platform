// My team's tabs' tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { MyTeamSeam, TeamFixtures, TeamTransactions } from "../../../src/myTeam/seam";
import { fakeTactics, type TacticsData } from "./tactics.harness";

/** What the fake server holds: the team's fixtures, null for a league with no rules, its
 *  transactions, and its tactics (tactics.harness.ts), or nothing yet while they load. A team with
 *  no games and no transactions by default. */
export type MyTeamData = TacticsData & { fixtures?: TeamFixtures | null; transactions?: TeamTransactions; loading?: boolean };

export function fakeMyTeam({
  fixtures = { teamName: "Team 1", format: "headToHead", games: [] },
  transactions = { transactions: [], cut: false },
  loading = false,
  ...tactics
}: MyTeamData = {}) {
  return {
    ...fakeTactics(tactics, loading),
    useTeamFixtures: vi.fn<MyTeamSeam["useTeamFixtures"]>(() => (loading ? undefined : fixtures)),
    useTeamTransactions: vi.fn<MyTeamSeam["useTeamTransactions"]>(() => (loading ? undefined : transactions)),
  };
}
