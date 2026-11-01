import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { matchRecordsOf } from "../gameweekScorer/heldMatches";
import { logFailure } from "../shared/errors";
import { heldSeason } from "../shared/fixtures";
import { seasonStartYear } from "../shared/time";
import { queueRefresh } from "./seasonPointsQueue";

// Season points when a played match moves (#525): the football sync hands over each match it
// marks dropped, sends again or moves gameweek, as his card's matches change with it. The sync
// only queues a job a match, so its own mutation reads no records and never fails for this.

/** How a match whose records can't be read is put right. */
export const REBUILD_COMMAND = `npx convex run stats/seasonPoints:rebuild '{"cursor":null}'`;

/** Queues a re-pricing job for each of these matches of the season held, as refresh sets no other
 *  season's row: so a rollover dropping last season's matches queues nothing. */
export async function repriceMatches(ctx: MutationCtx, fixtures: readonly Pick<Doc<"fixtures">, "code" | "kickoff">[]): Promise<void> {
  if (fixtures.length === 0) return;
  const season = await heldSeason(ctx);
  for (const { code, kickoff } of fixtures) {
    if (kickoff === null || seasonStartYear(kickoff) !== season) continue;
    await ctx.scheduler.runAfter(0, internal.stats.seasonPointsMoves.repriceMatch, { fixtureCode: code });
  }
}

/** Queues the re-pricing of everyone with a record in the match. One whose records can't be read
 *  is logged, naming the rebuild that puts it right, and queues nothing. */
export const repriceMatch = internalMutation({
  args: { fixtureCode: v.number() },
  returns: v.null(),
  handler: async (ctx, { fixtureCode }) => {
    let records: Doc<"playerMatchStats">[];
    try {
      records = await matchRecordsOf(ctx, fixtureCode, "its players' season points");
    } catch (error) {
      logFailure(`match ${fixtureCode}'s players' season points weren't re-priced; run ${REBUILD_COMMAND}`, error);
      return null;
    }
    await queueRefresh(ctx, records.map(({ playerCode }) => playerCode));
    return null;
  },
});
