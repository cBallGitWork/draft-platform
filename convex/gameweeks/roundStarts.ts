import type { MutationCtx, QueryCtx } from "../_generated/server";
import { takeAllOrThrow } from "../shared/cappedRead";
import { seasonStartYear } from "../shared/time";
import type { ScheduledMatch } from "./deadline";
import { firstKickoffs } from "./gameweekStarts";

// A gameweek is a date window (spec/05 S05.22, spec/07 S07.9; Craig, #1196): gameweek N runs from
// the feed's round N's first kickoff as first scheduled to round N+1's, and each match counts in
// the window it kicks off in, so a rearranged match makes a double or a blank week. The feed's
// rounds aren't followed after that. The first time a sync sees a round with a kickoff time, its
// first kickoff is recorded here, and no later move changes it. Feed-agnostic: a round is the
// number the feed gives a match, FPL's `event` today, Sportmonks' round once #1424 lands. Rounds are
// numbered afresh each season, so they are kept by season, the one their kickoffs fall in.
//
// The deadline still follows the gameweek's first kickoff as it stands (spec/03, deadline.ts): only
// the windows' dates stay as first scheduled.

/** More rounds than any season has: a read past it throws rather than cut one off. */
export const ROUNDS_READ_MOST = 100;

/** Matches by the season their kickoff falls in; one with no kickoff time is in none. */
function bySeason<Match extends ScheduledMatch>(matches: readonly Match[]): Map<number, Match[]> {
  const seasons = new Map<number, Match[]>();
  for (const match of matches) {
    if (match.kickoff === null) continue;
    const season = seasonStartYear(match.kickoff);
    seasons.set(season, [...(seasons.get(season) ?? []), match]);
  }
  return seasons;
}

/** Each recorded round's first kickoff in `season`, by round. */
export async function roundStartsOf(ctx: QueryCtx, season: number): Promise<Map<number, number>> {
  const rows = await takeAllOrThrow(
    ctx.db.query("roundStarts").withIndex("by_season_and_round", (q) => q.eq("season", season)),
    ROUNDS_READ_MOST,
    `More than ${ROUNDS_READ_MOST} round starts are held for one season, so its latest rounds' first kickoffs would be lost`,
  );
  return new Map(rows.map((row) => [row.round, row.firstKickoff]));
}

/** Records the first kickoff of each round in `matches` (`gameweek` is the feed's round) that has
 *  a kickoff time and none recorded yet. A round already recorded is left where it was first
 *  seen, so recording again does no harm. A sync hands its matches over in kickoff order
 *  (`inKickoffOrder`), so the first batch to name a round holds its first kickoff. */
export async function recordRoundStarts(ctx: MutationCtx, matches: readonly ScheduledMatch[], now: number): Promise<void> {
  for (const [season, inSeason] of bySeason(matches)) {
    const recorded = await roundStartsOf(ctx, season);
    for (const [round, firstKickoff] of firstKickoffs(inSeason)) {
      if (recorded.has(round)) continue;
      await ctx.db.insert("roundStarts", { season, round, firstKickoff, recordedAt: now });
    }
  }
}

/** The gameweek a kickoff falls in: the round whose recorded start is the latest at or before it.
 *  Null with no kickoff time, or before the season's first round starts. Pure. */
export function windowGameweek(kickoff: number | null, starts: ReadonlyMap<number, number>): number | null {
  if (kickoff === null) return null;
  let found: { round: number; start: number } | null = null;
  for (const [round, start] of starts) {
    if (start <= kickoff && (found === null || start > found.start)) found = { round, start };
  }
  return found?.round ?? null;
}

/** `matches` with each one's `gameweek` the window its kickoff falls in, in place of the feed's
 *  round, once each round new to the record has its start recorded. A match with no kickoff time
 *  is in no gameweek until it gets one, nor is one the feed puts in no round: its way of saying a
 *  postponed match waits for a new date, whatever kickoff it still names. */
export async function placeInWindows<Match extends ScheduledMatch>(
  ctx: MutationCtx,
  matches: readonly Match[],
  now: number,
): Promise<Match[]> {
  await recordRoundStarts(ctx, matches, now);
  const starts = new Map<number, Map<number, number>>();
  for (const season of bySeason(matches).keys()) starts.set(season, await roundStartsOf(ctx, season));
  return matches.map((match) => ({
    ...match,
    gameweek: match.kickoff === null || match.gameweek === null ? null : windowGameweek(match.kickoff, starts.get(seasonStartYear(match.kickoff))!),
  }));
}

/** `matches` earliest kickoff first, those with no kickoff time last, so each round's first
 *  kickoff reaches `recordRoundStarts` in the first batch that names the round. Pure. */
export function inKickoffOrder<Match extends ScheduledMatch>(matches: readonly Match[]): Match[] {
  return matches.toSorted((one, other) => (one.kickoff ?? Infinity) - (other.kickoff ?? Infinity));
}
