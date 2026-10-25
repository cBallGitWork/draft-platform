// Scouting's tests' fake seam (shell.harness.tsx hands it to the app): the players it holds,
// filtered and sorted by the server's own rule (listOf), so a test sees what a filter keeps.

import { vi } from "vitest";
import type { ListedPlayer } from "../../../convex/scouting/playersList";
import { listOf } from "../../../convex/scouting/playersOrder";
import type { PlayersList, ScoutingSeam } from "../../../src/scouting/seam";

/** What the fake server holds: its clubs and players, or nothing yet while it loads. */
export type ScoutingData = { clubs?: PlayersList["clubs"]; players?: readonly ListedPlayer[]; loading?: boolean };

export function fakeScouting({ clubs = [], players = [], loading = false }: ScoutingData = {}) {
  return {
    usePlayersList: vi.fn<ScoutingSeam["usePlayersList"]>((_leagueId, filters, sort) =>
      loading ? undefined : { clubs, players: listOf(players, filters, sort) },
    ),
  };
}
