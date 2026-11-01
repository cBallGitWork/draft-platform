import type { MutationCtx, QueryCtx } from "../_generated/server";
import { seasonStartYear } from "../shared/time";
import type { ScheduledMatch } from "./deadline";
import { GAMEWEEKS } from "./usedGameweeks";

// Each gameweek's first kickoff, once passed, kept where it fell even if that match then leaves the
// gameweek (#414), as a passed deadline is (#150). The site's scoring version for a gameweek hangs
// on it (siteVersions.ts). deadlineRecorder.ts records it before every write that can move a kickoff.
// FPL numbers each season's gameweeks 1 to 38 again, so it is kept by season and read for the
// season of the matches held.

/** Each gameweek's earliest kickoff among `matches`, by gameweek: none for a gameweek with no
 *  kickoff time. */
export function firstKickoffs(matches: readonly ScheduledMatch[]): Map<number, number> {
  const first = new Map<number, number>();
  for (const { gameweek, kickoff } of matches) {
    if (gameweek === null || kickoff === null) continue;
    first.set(gameweek, Math.min(kickoff, first.get(gameweek) ?? kickoff));
  }
  return first;
}

/** The season these matches are for: the one their latest kickoff falls in. Null with none. The
 *  same count as convex/shared/fixtures.ts's exported `heldSeason`, which reads the held matches'
 *  latest from the database; this one counts a list already read. */
function seasonOfMatches(matches: readonly ScheduledMatch[]): number | null {
  const kickoffs = matches.flatMap(({ kickoff }) => (kickoff === null ? [] : [kickoff]));
  return kickoffs.length === 0 ? null : seasonStartYear(Math.max(...kickoffs));
}

/** Records the first kickoff of each gameweek that has kicked off by `now` and has none recorded
 *  yet. Recording again does no harm. */
export async function recordGameweekStarts(ctx: MutationCtx, matches: readonly ScheduledMatch[], now: number): Promise<void> {
  const season = seasonOfMatches(matches);
  if (season === null) return;
  const recorded = await gameweekStartsOf(ctx, matches);
  // While a new season's matches arrive, last season's are still held: they start nothing in this one.
  const thisSeason = matches.filter(({ kickoff }) => kickoff !== null && seasonStartYear(kickoff) === season);
  for (const [gameweek, firstKickoff] of firstKickoffs(thisSeason)) {
    if (firstKickoff > now || recorded.has(gameweek)) continue;
    await ctx.db.insert("gameweekStarts", { season, gameweek, firstKickoff, recordedAt: now });
  }
}

/** Each recorded gameweek's first kickoff in the season of the held `matches`, by gameweek. */
export async function gameweekStartsOf(ctx: QueryCtx, matches: readonly ScheduledMatch[]): Promise<Map<number, number>> {
  const season = seasonOfMatches(matches);
  if (season === null) return new Map();
  const rows = await ctx.db
    .query("gameweekStarts")
    .withIndex("by_season_and_gameweek", (q) => q.eq("season", season))
    // Never more: `recordGameweekStarts` writes one row a season and gameweek, of FPL's 38.
    .take(GAMEWEEKS);
  return new Map(rows.map((row) => [row.gameweek, row.firstKickoff]));
}
