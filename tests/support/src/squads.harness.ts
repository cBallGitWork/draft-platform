// The squads screen's tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { FoundPlayer, SquadsSeam, SquadWithWarnings } from "../../../src/squads/seam";

/** What the fake server holds: each team's squad, and who a search finds. */
export type SquadsData = { squads?: readonly SquadWithWarnings[]; found?: readonly FoundPlayer[]; loading?: boolean; searching?: boolean };

/** Every change succeeds, unless a test says otherwise; a search finds `found` for any text.
 *  `loading` keeps the squads, and `searching` a search, still on their way (undefined). */
export function fakeSquads({ squads = [], found = [], loading = false, searching = false }: SquadsData = {}) {
  return {
    useSquads: vi.fn<SquadsSeam["useSquads"]>(() => (loading ? undefined : squads)),
    useFoundPlayers: vi.fn<SquadsSeam["useFoundPlayers"]>((_leagueId, text) => (searching ? undefined : text.trim() ? found : [])),
    assign: vi.fn<SquadsSeam["assign"]>(async () => null),
    move: vi.fn<SquadsSeam["move"]>(async () => null),
    release: vi.fn<SquadsSeam["release"]>(async () => null),
  };
}

/** A team's squad as the server sends it. */
export const squadWithWarnings = (teamId: string, teamName: string, players: SquadWithWarnings["players"] = [], warnings: SquadWithWarnings["warnings"] = [], unheld: SquadWithWarnings["unheld"] = []): SquadWithWarnings => ({
  teamId: teamId as Id<"teams">,
  teamName,
  players,
  unheld,
  warnings,
});
