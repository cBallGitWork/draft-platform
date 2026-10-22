// The gameweeks screen's tests' fake seam (shell.harness.tsx hands it to the app): a season whose
// first BEGUN gameweeks have begun when a test opens the app, all played.

import { vi } from "vitest";
import type { LeagueGameweek } from "../../../convex/gameweeks/leagueGameweeks";
import { HOUR_MS, WEEK_MS } from "../../../convex/shared/time";
import type { GameweeksSeam, LeagueGameweeksView } from "../../../src/gameweeks/seam";
import { weeklySeason } from "../../../src/gameweeks/weeklySeason";

/** Gameweeks 1 to BEGUN have begun when a test opens the app; BEGUN + 1's deadline is an hour on. */
export const BEGUN = 10;

/** The season as the server sends it, `unused` unticked. */
export function season(unused: number[] = []): LeagueGameweek[] {
  const nextDeadline = Date.now() + HOUR_MS;
  return weeklySeason(nextDeadline - BEGUN * WEEK_MS, unused);
}

/** Ticking succeeds, unless a test says otherwise; the season is all played, unless a test
 *  changes what `useLeagueGameweeks` returns. */
export function fakeGameweeks() {
  const setUsed = vi.fn<LeagueGameweeksView["setUsed"]>(async () => null);
  const gameweeks = season();
  const useLeagueGameweeks = vi.fn<GameweeksSeam["useLeagueGameweeks"]>(() => ({ gameweeks, setUsed }));
  return { useLeagueGameweeks, setUsed };
}
