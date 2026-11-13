import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { takeAllOrThrow } from "../shared/cappedRead";
import { byKickoff } from "../shared/fixtures";
import { seasonStartYear } from "../shared/time";
import type { ScheduledMatch } from "./deadline";
import { GAMEWEEKS_MOST } from "./usedGameweeks";
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
    GAMEWEEKS_MOST,
    `More than ${GAMEWEEKS_MOST} round starts are held for one season, so its latest rounds' first kickoffs would be lost`,
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

/** The admin's move of the match to another gameweek (matchMoves.ts, #1417), or null while he
 *  hasn't moved it. */
export function moveOf(ctx: QueryCtx, fixtureCode: number): Promise<Doc<"matchMoves"> | null> {
  return ctx.db
    .query("matchMoves")
    .withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", fixtureCode))
    .unique();
}

/** The most moves one sync reads at once: a season's 380 matches. */
export const MATCH_MOVES_READ_MOST = 380;

/** `matches` with each one's `gameweek` the window its kickoff falls in, in place of the feed's
 *  round, once each round new to the record has its start recorded. A match with no kickoff time
 *  is in no gameweek until it gets one, nor is one the feed puts in no round: its way of saying a
 *  postponed match waits for a new date, whatever kickoff it still names. A match the admin has
 *  moved stays in the gameweek he moved it to: the window rule yields to him (#1417), and where the
 *  rule would put it is kept on his move, for when he clears it. His moves are read once a sync. */
export async function placeInWindows<Match extends ScheduledMatch & { code: number }>(
  ctx: MutationCtx,
  matches: readonly Match[],
  now: number,
): Promise<Match[]> {
  await recordRoundStarts(ctx, matches, now);
  const starts = new Map<number, Map<number, number>>();
  for (const season of bySeason(matches).keys()) starts.set(season, await roundStartsOf(ctx, season));
  const held = await takeAllOrThrow(
    ctx.db.query("matchMoves"),
    MATCH_MOVES_READ_MOST,
    `More than ${MATCH_MOVES_READ_MOST} matches are moved, so a sync would leave some of the admin's moves unread`,
  );
  const moves = new Map(held.map((move) => [move.fixtureCode, move]));
  const placed: Match[] = [];
  for (const match of matches) {
    const unmoved = match.kickoff === null || match.gameweek === null ? null : windowGameweek(match.kickoff, starts.get(seasonStartYear(match.kickoff))!);
    const move = moves.get(match.code);
    if (move !== undefined && move.unmoved !== unmoved) await ctx.db.patch("matchMoves", move._id, { unmoved });
    placed.push({ ...match, gameweek: move?.gameweek ?? unmoved });
  }
  return placed;
}

/** `matches` earliest kickoff first, those with no kickoff time last, so each round's first
 *  kickoff reaches `recordRoundStarts` in the first batch that names the round. Pure. */
export function inKickoffOrder<Match extends ScheduledMatch>(matches: readonly Match[]): Match[] {
  return byKickoff(matches);
}
