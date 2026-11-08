// The seam for league home (#387): what the screen reads. Convex fills it in live (liveHome.ts);
// the preview and the tests hand the screen their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueHome } from "../../convex/home/leagueHome";
import type { LeagueNews, NewsMove } from "../../convex/home/leagueNews";

export type { LeagueHome, LeagueNews, NewsMove };
export type Recap = NonNullable<LeagueHome["recap"]>;

/** What a page of the News tab asks for: the moves below `before` (null for the newest), of one
 *  team and of one kind when not null. */
export type NewsAsked = { before: LeagueNews["older"]; teamId: Id<"teams"> | null; kind: NewsMove["kind"] | null };

export type HomeSeam = {
  /** League home at the minute `now`, live (a hook): undefined while it loads, null for a league
   *  made before rules were held. */
  useLeagueHome(leagueId: Id<"leagues">, now: number): LeagueHome | null | undefined;
  /** The league's recap of the gameweek, whole, live (a hook): undefined while it loads, null
   *  while there is none. */
  useRecap(leagueId: Id<"leagues">, gameweek: number): Recap | null | undefined;
  /** A page of the News tab's moves (#1356), live (a hook): undefined while it loads. */
  useLeagueNews(leagueId: Id<"leagues">, asked: NewsAsked): LeagueNews | undefined;
};
