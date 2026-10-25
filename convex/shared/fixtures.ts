import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

// The Premier League's matches as the football sync holds them (#21). Like clubs and players
// (players.ts), a match is never deleted, only marked dropped when the feed stops sending it, so
// the table grows by a season's 380 each season: reads here are of the current ones (#214).

/** The most matches held as current at once: a season's 380, with room. More throws, never a
 *  silent cut. */
export const CURRENT_FIXTURES_MOST = 500;

/** The matches the feed still sends, dropped ones left out, in kickoff order (those with no
 *  kickoff time first); only those kicked off by `kickedOffBy`, when given. */
export async function currentFixtures(ctx: QueryCtx, kickedOffBy?: number): Promise<Doc<"fixtures">[]> {
  const fixtures = await ctx.db
    .query("fixtures")
    .withIndex("by_droppedAt_and_kickoff", (q) =>
      kickedOffBy === undefined ? q.eq("droppedAt", undefined) : q.eq("droppedAt", undefined).lte("kickoff", kickedOffBy),
    )
    .take(CURRENT_FIXTURES_MOST + 1);
  if (fixtures.length > CURRENT_FIXTURES_MOST) throw new Error(`More than ${CURRENT_FIXTURES_MOST} matches are held as current, so they would be cut short`);
  return fixtures;
}
