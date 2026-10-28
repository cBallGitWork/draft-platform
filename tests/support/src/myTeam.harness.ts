// My team's tabs' tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { MyTeamSeam, SquadNumberChanges, TeamFixtures, TeamSquad, TeamTransactions } from "../../../src/myTeam/seam";
import { fakeTactics, type TacticsData } from "./tactics.harness";

/** What the fake server holds: the team's fixtures, null for a league with no rules, its
 *  transactions and squad, and its tactics (tactics.harness.ts), or nothing yet while they load. A
 *  team with no games, transactions or players by default. */
/** The fake server's team for the manager, as src/table/drawnTable.ts names Team 1's. */
export const MY_TEAM_ID = "id-Team 1" as Id<"teams">;

export type MyTeamData = TacticsData & {
  fixtures?: TeamFixtures | null;
  transactions?: TeamTransactions;
  squad?: TeamSquad;
  /** What setting a squad number answers: null once made, or the words why not. */
  numberAnswer?: string | null;
  loading?: boolean;
};

export function fakeMyTeam({
  fixtures = { teamId: MY_TEAM_ID, teamName: "Team 1", format: "headToHead", games: [], unscored: [] },
  transactions = { transactions: [], cut: false },
  squad = { teamName: "Team 1", lastGameweek: null, players: [] },
  numberAnswer = null,
  loading = false,
  ...tactics
}: MyTeamData = {}) {
  const numbers = { set: vi.fn<SquadNumberChanges["set"]>(async () => numberAnswer) };
  return {
    ...fakeTactics(tactics, loading),
    useTeamFixtures: vi.fn<MyTeamSeam["useTeamFixtures"]>(() => (loading ? undefined : fixtures)),
    useTeamTransactions: vi.fn<MyTeamSeam["useTeamTransactions"]>(() => (loading ? undefined : transactions)),
    useTeamSquad: vi.fn<MyTeamSeam["useTeamSquad"]>(() => (loading ? undefined : squad)),
    useSquadNumbers: () => numbers,
  };
}
