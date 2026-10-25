// Scouting's tests' fake seam (shell.harness.tsx hands it to the app): the players it holds,
// filtered and sorted by the server's own rule (listOf), so a test sees what a filter keeps, and
// any two of them side by side.

import { vi } from "vitest";
import type { ListedPlayer } from "../../../convex/scouting/playersList";
import { listOf } from "../../../convex/scouting/playersOrder";
import type { ComparedPlayer, PlayersList, ScoutingSeam } from "../../../src/scouting/seam";

/** What the fake server holds: its clubs and players, each one's season to compare (matches and
 *  stats added up) by his code, or nothing yet while the list or the comparison loads. */
export type ScoutingData = {
  clubs?: PlayersList["clubs"];
  players?: readonly ListedPlayer[];
  seasons?: Record<number, Pick<ComparedPlayer, "matches" | "stats">>;
  loading?: boolean;
  comparing?: boolean;
};

/** A player with no season held: no matches yet. */
const NO_SEASON = { matches: 0, stats: {} };

export function fakeScouting({ clubs = [], players = [], seasons = {}, loading = false, comparing = false }: ScoutingData = {}) {
  return {
    usePlayersList: vi.fn<ScoutingSeam["usePlayersList"]>((_leagueId, filters, sort) =>
      loading ? undefined : { clubs, players: listOf(players, filters, sort) },
    ),
    useComparison: vi.fn<ScoutingSeam["useComparison"]>((_leagueId, codes) =>
      codes === null || comparing
        ? undefined
        : codes.map((code) => ({ ...players.find((player) => player.code === code)!, ...(seasons[code] ?? NO_SEASON) })),
    ),
  };
}
