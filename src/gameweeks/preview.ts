// A made-up season, for the gameweeks screen's preview (src/preview.ts) and its tests: a deadline a
// week apart for each of FPL's gameweeks.

import type { LeagueGameweek } from "../../convex/leagueGameweeks";
import { WEEK_MS } from "../../convex/time";
import { GAMEWEEKS } from "../../convex/usedGameweeks";
import type { GameweeksSeam } from "./seam";

/** The season as the server sends it: gameweek 1's deadline at `firstDeadline`, each next a week
 *  on, and `unused` unticked. */
export function weeklySeason(firstDeadline: number, unused: readonly number[] = []): LeagueGameweek[] {
  return Array.from({ length: GAMEWEEKS }, (_, index) => ({
    gameweek: index + 1,
    used: !unused.includes(index + 1),
    deadline: firstDeadline + index * WEEK_MS,
  }));
}

/** Saturday mornings from mid-August, so the first ten or so have begun by late October, with a
 *  Christmas break unticked. Ticking changes nothing, and says so. */
const season = weeklySeason(Date.UTC(2026, 7, 15, 10, 0), [17, 18, 19]);
export const previewGameweeks: GameweeksSeam = {
  useLeagueGameweeks: () => ({
    gameweeks: season,
    setUsed: async () => "This is a preview: no gameweek was changed.",
  }),
};
