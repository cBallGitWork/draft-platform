// The squads screen's tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import type { FoundPlayer, SquadsSeam, TeamSquad } from "./seam";

/** What the fake server holds: each team's squad, and who a search finds. */
export type SquadsData = { squads?: readonly TeamSquad[]; found?: readonly FoundPlayer[] };

/** Every change succeeds, unless a test says otherwise; a search finds `found` for any text. */
export function fakeSquads({ squads = [], found = [] }: SquadsData = {}) {
  return {
    useSquads: vi.fn<SquadsSeam["useSquads"]>(() => squads),
    useFoundPlayers: vi.fn<SquadsSeam["useFoundPlayers"]>((_leagueId, text) => (text.trim() ? found : [])),
    assign: vi.fn<SquadsSeam["assign"]>(async () => null),
    move: vi.fn<SquadsSeam["move"]>(async () => null),
    release: vi.fn<SquadsSeam["release"]>(async () => null),
  };
}

/** A team's squad as the server sends it. */
export const teamSquad = (teamId: string, teamName: string, players: TeamSquad["players"] = [], warnings: TeamSquad["warnings"] = []): TeamSquad => ({
  teamId: teamId as Id<"teams">,
  teamName,
  players,
  warnings,
});
