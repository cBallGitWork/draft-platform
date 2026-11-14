import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { takeAllOrThrow } from "./cappedRead";
import { seasonStartYear } from "./time";

// The Premier League's matches as the football sync holds them (#21). Like clubs and players
// (players.ts), a match is never deleted, only marked dropped when the feed stops sending it, so
// the table grows by a season's 380 each season: reads here are of the current ones (#214).

/** The most matches held as current at once: a season's 380, with room. More throws, never a
 *  silent cut. */
export const CURRENT_FIXTURES_MOST = 500;

/** The most matches one gameweek holds: ten, or more with a match moved into it, with room. More
 *  throws, never a silent cut. */
export const GAMEWEEK_MATCHES_MOST = 40;

/** The match with `code`, dropped or not, or null while the football sync holds no such match:
 *  each caller says what a missing one means. */
export function fixtureByCode(ctx: QueryCtx, code: number): Promise<Doc<"fixtures"> | null> {
  return ctx.db
    .query("fixtures")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();
}

type KicksOff = { kickoff: number | null };

/** Postponed and not rearranged into its gameweek: a match with no kickoff time (scoreReads.ts). */
export const isPostponedFixture = (fixture: KicksOff) => fixture.kickoff === null;

/** The codes of a gameweek's matches its final scores stand on: each with a kickoff. A postponed
 *  one counts as never played (spec/05 S05.4), so the gameweek goes final once the rest lock; one
 *  rearranged into it gets a kickoff, joins these and so reopens it (#2040). */
export const datedCodes = (fixtures: readonly (KicksOff & { code: number })[]): number[] =>
  fixtures.flatMap((fixture) => (isPostponedFixture(fixture) ? [] : [fixture.code]));

/** Whether two lists hold the same match codes (or teams), in any order. */
export function sameCodes<Code>(one: readonly Code[], other: readonly Code[]): boolean {
  const others = new Set(other);
  return one.length === others.size && one.every((code) => others.has(code));
}

/** Two matches in kickoff order, any with no time yet last. */
export const byKickoffOrder = (one: KicksOff, other: KicksOff) =>
  (one.kickoff === null ? 1 : 0) - (other.kickoff === null ? 1 : 0) || (one.kickoff ?? 0) - (other.kickoff ?? 0);

/** Matches by kickoff, any with no time yet last. Pure. */
export const byKickoff = <Match extends KicksOff>(matches: readonly Match[]): Match[] => matches.toSorted(byKickoffOrder);

/** The season these matches are for: the one their latest kickoff falls in. Null while none has a
 *  kickoff time. */
export function seasonOfMatches(matches: readonly { kickoff: number | null }[]): number | null {
  const kickoffs = matches.flatMap(({ kickoff }) => (kickoff === null ? [] : [kickoff]));
  return kickoffs.length === 0 ? null : seasonStartYear(Math.max(...kickoffs));
}

/** The season the matches the feed still sends are for (`seasonOfMatches`), read from the one
 *  with the latest kickoff. gameweeks/seasonGameweeks.ts's `heldGameweeksSeason` reads the held
 *  gameweeks' season instead. */
export async function heldFixturesSeason(ctx: QueryCtx): Promise<number | null> {
  const latest = await ctx.db
    .query("fixtures")
    .withIndex("by_droppedAt_and_kickoff", (q) => q.eq("droppedAt", undefined))
    .order("desc")
    .first();
  return seasonOfMatches(latest === null ? [] : [latest]);
}

/** The gameweek's matches the feed still sends, in no set order. Past GAMEWEEK_MATCHES_MOST it
 *  throws, its message ending in `why`: what the caller would cut short. */
export function gameweekFixtures(ctx: QueryCtx, gameweek: number, why: string): Promise<Doc<"fixtures">[]> {
  return takeAllOrThrow(
    ctx.db.query("fixtures").withIndex("by_gameweek_and_droppedAt", (q) => q.eq("gameweek", gameweek).eq("droppedAt", undefined)),
    GAMEWEEK_MATCHES_MOST,
    `More than ${GAMEWEEK_MATCHES_MOST} matches are held for gameweek ${gameweek}, so ${why}`,
  );
}

/** The matches the feed still sends, dropped ones left out, in kickoff order (those with no
 *  kickoff time first); only those kicked off by `kickedOffBy`, when given, and from
 *  `kickedOffFrom` on, when given (which leaves out those with no kickoff time). */
export function currentFixtures(ctx: QueryCtx, kickedOffBy?: number, kickedOffFrom?: number): Promise<Doc<"fixtures">[]> {
  return takeAllOrThrow(
    ctx.db.query("fixtures").withIndex("by_droppedAt_and_kickoff", (q) => {
      const current = q.eq("droppedAt", undefined);
      const from = kickedOffFrom === undefined ? current : current.gte("kickoff", kickedOffFrom);
      return kickedOffBy === undefined ? from : from.lte("kickoff", kickedOffBy);
    }),
    CURRENT_FIXTURES_MOST,
    `More than ${CURRENT_FIXTURES_MOST} matches are held as current, so they would be cut short`,
  );
}
