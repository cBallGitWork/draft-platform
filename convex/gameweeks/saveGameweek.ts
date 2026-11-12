import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { seasonRules, type SeasonRules } from "../rules/rulesHistory";
import type { ScheduledMatch } from "./deadline";
import { deadlineOf, leagueDeadlines, leagueDeadlinesIn } from "./leagueDeadlines";
import { nextByDeadlines } from "./nextGameweek";
import { seasonGameweekCount } from "./seasonGameweeks";
import { lastPlayedGameweek } from "./usedGameweeks";

// The gameweek a save made now goes to: a lineup's (lineup/lineups.ts), and what the Tactics tab,
// the lineup-due flag, the auto team, the squad's schedule and the position warnings read as next.

/** The first gameweek after the last begun by the league's own deadlines (`leagueDeadlines`, the
 *  ones its screens and refusals read), so a save lands in the gameweek the screens mark as next
 *  (#1764): the one a save now is from. Once every gameweek of the season has begun, the one after
 *  its last. A caller asking for many leagues hands in the `matches` it read once
 *  (`scheduledMatches`). */
export async function nextOpenGameweek(ctx: QueryCtx, leagueId: Id<"leagues">, now: number, matches?: readonly ScheduledMatch[]): Promise<number> {
  const deadlines = matches === undefined ? await leagueDeadlines(ctx, leagueId) : await leagueDeadlinesIn(ctx, leagueId, matches);
  const gameweeks = [...deadlines.keys()];
  return nextByDeadlines(gameweeks, deadlineOf(deadlines), now) ?? (gameweeks.at(-1) ?? 0) + 1;
}

/** The gameweek a save now goes to, or why there is none: once every gameweek the league plays
 *  has begun its season is over, so one that ends early is over after its last (spec/13,
 *  Gameweeks). Each caller says what that means for it. */
type SaveGameweek =
  | { kind: "seasonOver" }
  | { kind: "open"; season: SeasonRules; gameweek: number };

/** The gameweek a save at `now` goes to (`nextOpenGameweek`), with the league's rules it was
 *  dated by. */
export async function saveGameweekOf(ctx: QueryCtx, leagueId: Id<"leagues">, now: number, matches?: readonly ScheduledMatch[]): Promise<SaveGameweek> {
  const season = await seasonRules(ctx, leagueId);
  const gameweek = await nextOpenGameweek(ctx, leagueId, now, matches);
  const league = await ctx.db.get("leagues", leagueId);
  if (league === null || gameweek > lastPlayedGameweek(league, await seasonGameweekCount(ctx))) return { kind: "seasonOver" };
  return { kind: "open", season, gameweek };
}
