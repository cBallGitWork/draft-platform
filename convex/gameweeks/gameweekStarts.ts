import type { MutationCtx, QueryCtx } from "../_generated/server";
import { seasonStartYear } from "../football/football";
import type { ScheduledMatch } from "./deadline";
import { GAMEWEEKS } from "./usedGameweeks";

// When each gameweek kicked off, once it has (#414): the first kickoff stays where it fell, even if
// that match is then postponed or abandoned and leaves the gameweek, as a passed deadline does
// (deadline.ts, #150). The site's scoring version for a gameweek hangs on it (siteScoring.ts), so a
// version that took effect after the gameweek began never reaches it (spec/14, Changes and
// corrections). deadlineRecorder.ts records it in the same transaction as, and before, every write
// that can move a kickoff. Site-wide, as the scoring is: no league's deadline plays a part.
//
// FPL numbers each season's gameweeks 1 to 38 again, so a start is kept by season and gameweek, and
// read for the season of the matches held.

/** Each gameweek's earliest kickoff among `matches`, by gameweek: none for a gameweek with no
 *  kickoff time. */
function firstKickoffs(matches: readonly ScheduledMatch[]): Map<number, number> {
  const first = new Map<number, number>();
  for (const { gameweek, kickoff } of matches) {
    if (gameweek === null || kickoff === null) continue;
    first.set(gameweek, Math.min(kickoff, first.get(gameweek) ?? kickoff));
  }
  return first;
}

/** The season the held matches are for: the one their latest kickoff falls in. Null with none. */
function heldSeason(matches: readonly ScheduledMatch[]): number | null {
  const kickoffs = matches.flatMap(({ kickoff }) => (kickoff === null ? [] : [kickoff]));
  return kickoffs.length === 0 ? null : seasonStartYear(Math.max(...kickoffs));
}

/** Records the first kickoff of each gameweek that has kicked off by `now` and has none recorded
 *  yet. Recording again does no harm. */
export async function recordGameweekStarts(ctx: MutationCtx, matches: readonly ScheduledMatch[], now: number): Promise<void> {
  const season = heldSeason(matches);
  if (season === null) return;
  const recorded = await gameweekStartsOf(ctx, matches);
  for (const [gameweek, firstKickoff] of firstKickoffs(matches)) {
    if (firstKickoff > now || recorded.has(gameweek)) continue;
    await ctx.db.insert("gameweekStarts", { season, gameweek, firstKickoff, recordedAt: now });
  }
}

/** Each recorded gameweek's first kickoff in the season of the held `matches`, by gameweek. */
export async function gameweekStartsOf(ctx: QueryCtx, matches: readonly ScheduledMatch[]): Promise<Map<number, number>> {
  const season = heldSeason(matches);
  if (season === null) return new Map();
  const rows = await ctx.db
    .query("gameweekStarts")
    .withIndex("by_season_and_gameweek", (q) => q.eq("season", season))
    .take(GAMEWEEKS);
  return new Map(rows.map((row) => [row.gameweek, row.firstKickoff]));
}
