// My team's tabs' tests' fake seam (shell.harness.tsx hands it to the app).

import { useSyncExternalStore } from "react";
import { vi } from "vitest";
import type { AutoTeamChanges, MyAutoTeam, MyTeamSeam, OtherSquad, SquadNumberChanges, TeamFixtures, TeamSquad, TeamTransactions } from "../../../src/myTeam/seam";
import { idOf } from "../../../src/table/drawnTable";
import type { LeagueTable } from "../../../src/table/seam";
import { fakeTactics, type TacticsData } from "./tactics.harness";
import type { LatestMail } from "../../../src/myTeam/squad/seam";
import type { ClaimChanges, PendingClaim, WaiversView } from "../../../src/myTeam/claims/seam";

/** What the fake server holds: the team's fixtures, null for a league with no rules, its
 *  transactions and squad, and its tactics (tactics.harness.ts), or nothing yet while they load. A
 *  team with no games, transactions or players by default. */
/** The fake server's team for the manager, as src/table/drawnTable.ts names Team 1's. */
export const MY_TEAM_ID = idOf("Team 1");

export type MyTeamData = TacticsData & {
  fixtures?: TeamFixtures;
  transactions?: TeamTransactions;
  squad?: TeamSquad;
  /** Another team's squad, read-only, whichever team is asked for. */
  otherSquad?: OtherSquad;
  /** The league's table and fixtures, which the header band reads; null for a league with no rules. */
  leagueTable?: LeagueTable;
  /** What setting a squad number answers: null once made, or the words why not. */
  numberAnswer?: string | null;
  /** The newest letters for the Squad tab's Mail widget, and the unread count. */
  mail?: LatestMail;
  /** The pending claims the caller sees, and the league's waiver order, runs and window (#1200). */
  claims?: PendingClaim[];
  waivers?: WaiversView;
  /** What each change to a claim answers: null once made, or the words why not. */
  claimAnswer?: string | null;
  /** The team's auto team: off by default, with no gameweek to end after unless named. */
  autoTeam?: Omit<MyAutoTeam, "teamId" | "endGameweeks"> & { endGameweeks?: number[] };
  /** What switching it answers: null once made, or the words why not. */
  autoTeamAnswer?: string | null;
  loading?: boolean;
};

/** A league's waivers with nobody's claims open to doubt: drafted, out of the lock, no runs. */
export const NO_WAIVERS: WaiversView = { type: "reverseStandings", teams: [], drafted: true, runs: [], locked: false, windowOpen: false, windowShuts: null, resetsAfter: null };

export function fakeMyTeam({
  fixtures = { teamId: MY_TEAM_ID, teamName: "Team 1", format: "headToHead", games: [], unscored: [] },
  transactions = { transactions: [], cut: false },
  squad = { teamName: "Team 1", lastGameweek: null, players: [], unheld: [], squadMaximum: null, scheduleGameweeks: [], limits: [] },
  otherSquad = { teamName: "Team 2", players: [] },
  numberAnswer = null,
  mail = { letters: [], unread: 0 },
  leagueTable = undefined,
  claims = [],
  waivers = NO_WAIVERS,
  claimAnswer = null,
  autoTeam = { on: false, endsAfter: null },
  autoTeamAnswer = null,
  loading = false,
  ...tactics
}: MyTeamData = {}) {
  const numbers = { set: vi.fn<SquadNumberChanges["set"]>(async () => numberAnswer) };
  const autoTeamChanges = { set: vi.fn<AutoTeamChanges["set"]>(async () => autoTeamAnswer) };
  const claimChanges = {
    rank: vi.fn<ClaimChanges["rank"]>(async () => claimAnswer),
    withdraw: vi.fn<ClaimChanges["withdraw"]>(async () => claimAnswer),
    changeDrop: vi.fn<ClaimChanges["changeDrop"]>(async () => claimAnswer),
  };
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
    useOtherSquad: vi.fn<MyTeamSeam["useOtherSquad"]>(() => (loading ? undefined : otherSquad)),
    useTeamSquad: vi.fn<MyTeamSeam["useTeamSquad"]>(() => useSyncExternalStore(subscribe, () => (loading ? undefined : heldSquad))),
    /** The squad the server holds from now on (inside act). */
    serverHoldsSquad: (next: TeamSquad) => {
      heldSquad = next;
      for (const listener of listeners) listener();
    },
    useSquadNumbers: () => numbers,
    useLatestMail: vi.fn<MyTeamSeam["useLatestMail"]>(() => (loading ? undefined : mail)),
    useLeagueTable: vi.fn<MyTeamSeam["useLeagueTable"]>(() => (loading ? undefined : leagueTable)),
    usePendingClaims: vi.fn<MyTeamSeam["usePendingClaims"]>(() => (loading ? undefined : claims)),
    useWaivers: vi.fn<MyTeamSeam["useWaivers"]>(() => (loading ? undefined : waivers)),
    useClaimChanges: () => claimChanges,
    claimChanges,
    useMyAutoTeam: vi.fn<MyTeamSeam["useMyAutoTeam"]>(() => (loading ? undefined : { teamId: MY_TEAM_ID, endGameweeks: [], ...autoTeam })),
    useAutoTeamChanges: () => autoTeamChanges,
    autoTeamChanges,
  };
}
