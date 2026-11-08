// Which gameweeks a league plays (#74; spec/13, Gameweeks): every one of FPL's season unless its
// commissioner unticked it. An unticked gameweek scores nothing and has no head-to-head: the
// fixtures (#33) skip it via `scoredGameweeksOf`, and scoring's `begunGameweeks`
// (convex/gameweekScorer/gameweekScores.ts) applies `isGameweekScored`, so it is never scored; lineups,
// waivers, free agency and trades are locked through it (spec/13; waiverLock.ts's `inUnplayedGameweek`
// and its waiver lock), and the league's season ends at the last it plays (`lastPlayedGameweek`). A gameweek before the league's scoring start
// (scoringStart.ts; spec/04, After the draft) is the same: those two leave it out too. Its only imports are a type, which compiles away, and
// Convex's validators, which the screens already load, so the screens can read it too.

import { v } from "convex/values";

/** FPL's season has gameweeks 1 to 38: FPL's rule, so constants. */
export const FIRST_GAMEWEEK = 1;
export const GAMEWEEKS = 38;

/** A gameweek's deadline as the screens get it: the league's own (leagueDeadlines.ts's
 *  `leagueDeadlines`), when the gameweek begins; null while none of its matches has a kickoff time. */
export const shownDeadline = v.union(v.number(), v.null());

/** The season's gameweeks, 1 to 38, in order. */
export const SEASON_GAMEWEEKS: readonly number[] = Array.from({ length: GAMEWEEKS }, (_, index) => FIRST_GAMEWEEK + index);

/** What of a league this reads: the gameweeks its commissioner unticked, stored as the league's
 *  `unusedGameweeks`, absent while it plays them all; and the gameweek its scoring starts in,
 *  `scoringStart`, absent while it scores every ticked gameweek. */
export type WithUnusedGameweeks = { unusedGameweeks?: readonly number[]; scoringStart?: number };

/** Whether this is one of the season's gameweeks, and what to say when it isn't. */
export const isGameweek = (gameweek: number) => Number.isInteger(gameweek) && gameweek >= FIRST_GAMEWEEK && gameweek <= GAMEWEEKS;
export const noSuchGameweek = (gameweek: number) => `There's no gameweek ${gameweek}: a season has gameweeks ${FIRST_GAMEWEEK} to ${GAMEWEEKS}.`;

/** Whether the league plays this gameweek. Asking of a gameweek the season doesn't have is a bug
 *  in the caller, so it throws. */
export function isGameweekUsed(league: WithUnusedGameweeks, gameweek: number): boolean {
  if (!isGameweek(gameweek)) throw new Error(noSuchGameweek(gameweek));
  return !(league.unusedGameweeks ?? []).includes(gameweek);
}

/** The gameweeks the league plays, in order. */
export const usedGameweeksOf = (league: WithUnusedGameweeks) => SEASON_GAMEWEEKS.filter((gameweek) => isGameweekUsed(league, gameweek));

/** The last gameweek the league plays, its season's end: before GAMEWEEKS for a league that ends
 *  early (spec/13, Gameweeks). One before the season's first when it plays none. */
export const lastPlayedGameweek = (league: WithUnusedGameweeks) => usedGameweeksOf(league).at(-1) ?? FIRST_GAMEWEEK - 1;

/** Whether the league scores this gameweek and plays its head-to-head: it is ticked, and not before
 *  the league's scoring start. Throws as `isGameweekUsed` does. */
export const isGameweekScored = (league: WithUnusedGameweeks, gameweek: number) =>
  isGameweekUsed(league, gameweek) && gameweek >= (league.scoringStart ?? FIRST_GAMEWEEK);

/** The gameweeks the league scores, in order. */
export const scoredGameweeksOf = (league: WithUnusedGameweeks) => SEASON_GAMEWEEKS.filter((gameweek) => isGameweekScored(league, gameweek));

/** The league's unticked gameweeks, in order, once this one is ticked (`used`) or unticked. */
export function unusedAfter(league: WithUnusedGameweeks, gameweek: number, used: boolean): number[] {
  const others = (league.unusedGameweeks ?? []).filter((each) => each !== gameweek);
  return used ? others : [...others, gameweek].sort((a, b) => a - b);
}
