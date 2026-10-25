// Scouting's tests' fake seam (shell.harness.tsx hands it to the app): the players it holds and
// their season totals, filtered and sorted by the server's own rule (listOf), so a test sees what a
// filter keeps.

import { vi } from "vitest";
import type { ListedPlayer } from "../../../convex/scouting/playersList";
import { listOf, shownStat } from "../../../convex/scouting/playersOrder";
import type { Stats } from "../../../convex/stats/statTotals";
import type { PlayersList, ScoutingSeam } from "../../../src/scouting/seam";
import { fakeShortlist, type ShortlistData } from "./shortlist.harness";

/** What the fake server holds: its clubs, players and their season totals by code, or nothing yet
 *  while it loads, and the shortlist. */
export type ScoutingData = {
  clubs?: PlayersList["clubs"];
  players?: readonly ListedPlayer[];
  totals?: Record<number, Stats>;
  loading?: boolean;
  shortlist?: ShortlistData;
};

export function fakeScouting({ clubs = [], players = [], totals = {}, loading = false, shortlist }: ScoutingData = {}) {
  return {
    ...fakeShortlist(shortlist),
    usePlayersList: vi.fn<ScoutingSeam["usePlayersList"]>((_leagueId, filters, sort, stat) =>
      loading
        ? undefined
        : { clubs, players: listOf(players.map((player) => ({ ...player, stat: shownStat(totals[player.code], stat) })), filters, sort) },
    ),
  };
}
