import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { GAMEWEEKS } from "./usedGameweeks";

// A league's passed deadlines as recorded (#150; deadline.ts says why, deadlineRecorder.ts writes
// them): one a gameweek at most.

/** The league's passed deadlines, by gameweek. */
export async function passedDeadlinesOf(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Map<number, number>> {
  const rows = await ctx.db
    .query("passedDeadlines")
    .withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", leagueId))
    .take(GAMEWEEKS);
  return new Map(rows.map((row) => [row.gameweek, row.deadline]));
}
