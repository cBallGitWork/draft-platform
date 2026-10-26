// My team's tabs' tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { MyTeamSeam, TeamFixtures } from "../../../src/myTeam/seam";
import { fakeTactics, type TacticsData } from "./tactics.harness";

/** What the fake server holds: the team's fixtures, null for a league with no rules, and its
 *  tactics (tactics.harness.ts), or nothing yet while they load. A team with no games by default. */
export type MyTeamData = TacticsData & { fixtures?: TeamFixtures | null; loading?: boolean };

export function fakeMyTeam({ fixtures = { teamName: "Team 1", format: "headToHead", games: [] }, loading = false, ...tactics }: MyTeamData = {}) {
  return {
    ...fakeTactics(tactics, loading),
    useTeamFixtures: vi.fn<MyTeamSeam["useTeamFixtures"]>(() => (loading ? undefined : fixtures)),
  };
}
