// My team's tabs' tests' fake seam (shell.harness.tsx hands it to the app).

import { useSyncExternalStore } from "react";
import { vi } from "vitest";
import type { MyTeamSeam, SquadNumberChanges, TeamFixtures, TeamSquad, TeamTransactions } from "../../../src/myTeam/seam";
import { idOf } from "../../../src/table/drawnTable";
import type { LeagueTable } from "../../../src/table/seam";
import { fakeTactics, type TacticsData } from "./tactics.harness";

/** What the fake server holds: the team's fixtures, null for a league with no rules, its
 *  transactions and squad, and its tactics (tactics.harness.ts), or nothing yet while they load. A
 *  team with no games, transactions or players by default. */
/** The fake server's team for the manager, as src/table/drawnTable.ts names Team 1's. */
export const MY_TEAM_ID = idOf("Team 1");

export type MyTeamData = TacticsData & {
  fixtures?: TeamFixtures | null;
  transactions?: TeamTransactions;
  squad?: TeamSquad;
  /** The league's table and fixtures, which the header band reads; null for a league with no rules. */
  leagueTable?: LeagueTable | null;
  /** What setting a squad number answers: null once made, or the words why not. */
  numberAnswer?: string | null;
  loading?: boolean;
};

export function fakeMyTeam({
  fixtures = { teamId: MY_TEAM_ID, teamName: "Team 1", format: "headToHead", games: [], unscored: [] },
  transactions = { transactions: [], cut: false },
  squad = { teamName: "Team 1", lastGameweek: null, players: [], unheld: [] },
  numberAnswer = null,
  leagueTable = null,
  loading = false,
  ...tactics
}: MyTeamData = {}) {
  const numbers = { set: vi.fn<SquadNumberChanges["set"]>(async () => numberAnswer) };
  // A store, so a test can change the squad under an open screen, as Convex would.
  let heldSquad = squad;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  };
  return {
    ...fakeTactics(tactics, loading),
    useTeamFixtures: vi.fn<MyTeamSeam["useTeamFixtures"]>(() => (loading ? undefined : fixtures)),
    useTeamTransactions: vi.fn<MyTeamSeam["useTeamTransactions"]>(() => (loading ? undefined : transactions)),
    useTeamSquad: vi.fn<MyTeamSeam["useTeamSquad"]>(() => useSyncExternalStore(subscribe, () => (loading ? undefined : heldSquad))),
    /** The squad the server holds from now on (inside act). */
    serverHoldsSquad: (next: TeamSquad) => {
      heldSquad = next;
      for (const listener of listeners) listener();
    },
    useSquadNumbers: () => numbers,
    useLeagueTable: vi.fn<MyTeamSeam["useLeagueTable"]>(() => (loading ? undefined : leagueTable)),
  };
}
