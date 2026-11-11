// Which gameweeks a league plays (#74; spec/13, Gameweeks): every one of its season unless its
// commissioner unticked it. An unticked gameweek scores nothing and has no head-to-head: the
// fixtures (#33) skip it via `scoredGameweeksOf`, and scoring's `begunGameweeks`
// (convex/gameweekScorer/gameweekScores.ts) applies `isGameweekScored`, so it is never scored; lineups,
// waivers, free agency and trades are locked through it (spec/13; waiverLock.ts's `inUnplayedGameweek`
// and its waiver lock), and the league's season ends at the last it plays (`lastPlayedGameweek`). A gameweek before the league's scoring start
// (scoringStart.ts; spec/04, After the draft) is the same: those two leave it out too. Its only imports are a type, which compiles away, and
// Convex's validators, which the screens already load, so the screens can read it too.
//
// How many gameweeks a season has is data, never a constant: however many gameweek windows it holds
// (Craig, 11 Nov 2026, #1618: "each league has its list of gameweek windows, and the count is
// however many it has"). The Premier League has 38, the Bundesliga 34. A server reads it with
// seasonGameweeks.ts's `seasonGameweekCount` and hands it to the helpers here as `count`.

import { v } from "convex/values";

/** A season's gameweeks are numbered from 1. */
export const FIRST_GAMEWEEK = 1;

/** More gameweeks than any season holds: the bound of a capped read of rows kept one a gameweek,
 *  so a read never cuts a season off. Never the season's count. */
export const GAMEWEEKS_MOST = 60;

/** A gameweek's deadline as the screens get it: the league's own (leagueDeadlines.ts's
 *  `leagueDeadlines`), when the gameweek begins; null while none of its matches has a kickoff time. */
export const shownDeadline = v.union(v.number(), v.null());

/** A season of `count` gameweeks' numbers, in order. */
export const seasonGameweeks = (count: number): number[] => Array.from({ length: count }, (_, index) => FIRST_GAMEWEEK + index);

/** What of a league this reads: the gameweeks its commissioner unticked, stored as the league's
 *  `unusedGameweeks`, absent while it plays them all; and the gameweek its scoring starts in,
 *  `scoringStart`, absent while it scores every ticked gameweek. */
export type WithUnusedGameweeks = { unusedGameweeks?: readonly number[]; scoringStart?: number };

/** Whether this is one of a season of `count` gameweeks, and what to say when it isn't. */
export const isGameweek = (gameweek: number, count: number) => Number.isInteger(gameweek) && gameweek >= FIRST_GAMEWEEK && gameweek <= count;
export const noSuchGameweek = (gameweek: number, count: number) =>
  `There's no gameweek ${gameweek}: this season has gameweeks ${FIRST_GAMEWEEK} to ${count}.`;

/** Whether the league plays this gameweek of its season of `count`. Asking of a gameweek the
 *  season doesn't have is a bug in the caller, so it throws. */
export function isGameweekUsed(league: WithUnusedGameweeks, gameweek: number, count: number): boolean {
  if (!isGameweek(gameweek, count)) throw new Error(noSuchGameweek(gameweek, count));
  return !(league.unusedGameweeks ?? []).includes(gameweek);
}

/** The gameweeks the league plays of its season of `count`, in order. */
export const usedGameweeksOf = (league: WithUnusedGameweeks, count: number) =>
  seasonGameweeks(count).filter((gameweek) => isGameweekUsed(league, gameweek, count));

/** The last gameweek the league plays, its season's end: before the season's last for a league
 *  that ends early (spec/13, Gameweeks). One before the season's first when it plays none. */
export const lastPlayedGameweek = (league: WithUnusedGameweeks, count: number) =>
  usedGameweeksOf(league, count).at(-1) ?? FIRST_GAMEWEEK - 1;

/** Whether the league scores this gameweek and plays its head-to-head: it is ticked, and not before
 *  the league's scoring start. Throws as `isGameweekUsed` does. */
export const isGameweekScored = (league: WithUnusedGameweeks, gameweek: number, count: number) =>
  isGameweekUsed(league, gameweek, count) && gameweek >= (league.scoringStart ?? FIRST_GAMEWEEK);

/** The gameweeks the league scores of its season of `count`, in order. */
export const scoredGameweeksOf = (league: WithUnusedGameweeks, count: number) =>
  seasonGameweeks(count).filter((gameweek) => isGameweekScored(league, gameweek, count));

/** The league's unticked gameweeks, in order, once this one is ticked (`used`) or unticked. */
export function unusedAfter(league: WithUnusedGameweeks, gameweek: number, used: boolean): number[] {
  const others = (league.unusedGameweeks ?? []).filter((each) => each !== gameweek);
  return used ? others : [...others, gameweek].sort((a, b) => a - b);
}
