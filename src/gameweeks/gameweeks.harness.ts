// The gameweeks screen's tests' fake seam (shell.harness.tsx hands it to the app): a season of
// FPL's 38 gameweeks a week apart, the first BEGUN of them already begun, all played.

import { vi } from "vitest";
import type { LeagueGameweek } from "../../convex/leagueGameweeks";
import { GAMEWEEKS } from "../../convex/usedGameweeks";
import type { GameweeksSeam, LeagueGameweeksView } from "./seam";

const WEEK = 7 * 24 * 60 * 60 * 1000;
/** Gameweeks 1 to BEGUN have begun when a test opens the app. */
export const BEGUN = 10;

/** The season as the server sends it, `unused` unticked; deadlines a week apart, gameweek
 *  BEGUN + 1's an hour from now. */
export function season(unused: number[] = []): LeagueGameweek[] {
  const next = Date.now() + 60 * 60 * 1000;
  return Array.from({ length: GAMEWEEKS }, (_, index) => ({
    gameweek: index + 1,
    used: !unused.includes(index + 1),
    deadline: next + (index - BEGUN) * WEEK,
  }));
}

/** Ticking succeeds, unless a test says otherwise; the season is all played, unless a test
 *  changes what `useLeagueGameweeks` returns before the page opens. */
export function fakeGameweeks() {
  const setUsed = vi.fn<LeagueGameweeksView["setUsed"]>(async () => null);
  const gameweeks = season();
  const useLeagueGameweeks = vi.fn<GameweeksSeam["useLeagueGameweeks"]>(() => ({ gameweeks, setUsed }));
  return { useLeagueGameweeks, setUsed };
}
