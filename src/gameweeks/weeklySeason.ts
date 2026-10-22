// A made-up season, for the gameweeks screen's preview (preview.ts) and its tests
// (gameweeks.harness.ts): the league's own deadline for each of the season's gameweeks, a week
// apart.

import type { LeagueGameweek } from "../../convex/gameweeks/leagueGameweeks";
import { WEEK_MS } from "../../convex/shared/time";
import { GAMEWEEKS } from "../../convex/gameweeks/usedGameweeks";

/** The season as the server sends it: gameweek 1's deadline at `firstDeadline`, each next a week
 *  on, and `unused` unticked. */
export function weeklySeason(firstDeadline: number, unused: readonly number[] = []): LeagueGameweek[] {
  return Array.from({ length: GAMEWEEKS }, (_, index) => ({
    gameweek: index + 1,
    used: !unused.includes(index + 1),
    deadline: firstDeadline + index * WEEK_MS,
  }));
}
