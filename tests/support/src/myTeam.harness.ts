// My team's tabs' tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { MyTeamSeam, TeamFixtures } from "../../../src/myTeam/seam";

/** What the fake server holds: the team's fixtures, null for a league with no rules, or nothing yet
 *  while it loads. A team with no games by default. */
export type MyTeamData = { fixtures?: TeamFixtures | null; loading?: boolean };

export function fakeMyTeam({ fixtures = { teamName: "Team 1", format: "headToHead", games: [] }, loading = false }: MyTeamData = {}) {
  return { useTeamFixtures: vi.fn<MyTeamSeam["useTeamFixtures"]>(() => (loading ? undefined : fixtures)) };
}
