// Which gameweeks a league plays (#74; spec/13, Gameweeks): every one of FPL's season unless its
// commissioner unticked it. An unticked gameweek scores nothing and has no head-to-head: the
// fixtures (#33) skip it via `usedGameweeksOf`, and scoring (#29) is still to apply it with
// `isGameweekUsed`; waivers, free agency and trades carry on through it. Its only imports are a
// type, which compiles away, and Convex's validators, which the screens already load, so the
// screens can read it too.

import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";

/** FPL's season has gameweeks 1 to 38: FPL's rule, so a constant. */
export const GAMEWEEKS = 38;

/** FPL's deadline, when it begins; null while the app doesn't have it. */
export const fplDeadline = v.union(v.number(), v.null());

/** FPL's deadline for each of gameweeks 1 to 38 the app holds, by gameweek. It reads dropped rows
 *  too; leagueRules.ts's `heldSchedule` skips them, and whether these should too is Craig's call. */
export async function fplDeadlines(ctx: QueryCtx): Promise<Map<number, number>> {
  const rows = await ctx.db
    .query("gameweeks")
    .withIndex("by_number", (q) => q.gte("number", 1).lte("number", GAMEWEEKS))
    .take(GAMEWEEKS);
  return new Map(rows.map((row) => [row.number, row.deadline]));
}

/** The season's gameweeks, 1 to 38, in order. */
export const SEASON_GAMEWEEKS: readonly number[] = Array.from({ length: GAMEWEEKS }, (_, index) => index + 1);

/** What of a league this reads: the gameweeks its commissioner unticked, stored as the league's
 *  `unusedGameweeks`. Absent while it plays them all. */
export type WithUnusedGameweeks = { unusedGameweeks?: readonly number[] };

/** Whether this is one of the season's gameweeks, and what to say when it isn't. */
export const isGameweek = (gameweek: number) => Number.isInteger(gameweek) && gameweek >= 1 && gameweek <= GAMEWEEKS;
export const noSuchGameweek = (gameweek: number) => `There's no gameweek ${gameweek}: a season has gameweeks 1 to ${GAMEWEEKS}.`;

/** Whether the league plays this gameweek. Asking of a gameweek the season doesn't have is a bug
 *  in the caller, so it throws. */
export function isGameweekUsed(league: WithUnusedGameweeks, gameweek: number): boolean {
  if (!isGameweek(gameweek)) throw new Error(noSuchGameweek(gameweek));
  return !(league.unusedGameweeks ?? []).includes(gameweek);
}

/** The gameweeks the league plays, in order. */
export const usedGameweeksOf = (league: WithUnusedGameweeks) => SEASON_GAMEWEEKS.filter((gameweek) => isGameweekUsed(league, gameweek));

/** The league's unticked gameweeks, in order, once this one is ticked (`used`) or unticked. */
export function unusedAfter(league: WithUnusedGameweeks, gameweek: number, used: boolean): number[] {
  const others = (league.unusedGameweeks ?? []).filter((each) => each !== gameweek);
  return used ? others : [...others, gameweek].sort((a, b) => a - b);
}
