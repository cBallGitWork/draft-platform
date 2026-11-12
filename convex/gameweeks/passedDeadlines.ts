import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { takeAllOrThrow } from "../shared/cappedRead";
import { GAMEWEEKS_MOST } from "./usedGameweeks";

// A league's passed deadlines as recorded (#150; deadline.ts says why, deadlineRecorder.ts writes
// them): one a gameweek at most.

/** The league's passed deadlines, by gameweek. */
export async function passedDeadlinesOf(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Map<number, number>> {
  const rows = await takeAllOrThrow(
    ctx.db.query("passedDeadlines").withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", leagueId)),
    GAMEWEEKS_MOST,
    `More than ${GAMEWEEKS_MOST} passed deadlines are held for one league, so its latest gameweeks would read as not begun`,
  );
  return new Map(rows.map((row) => [row.gameweek, row.deadline]));
}

/** The league's passed deadline for the gameweek, or null while none is recorded. */
export async function passedDeadlineOf(ctx: QueryCtx, leagueId: Id<"leagues">, gameweek: number): Promise<number | null> {
  const row = await ctx.db
    .query("passedDeadlines")
    .withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", leagueId).eq("gameweek", gameweek))
    .unique();
  return row?.deadline ?? null;
}

/** The league's deadlines that stay where they are whatever the matches now say, by gameweek: each
 *  passed one (#150), else the one kept when FPL stopped sending its gameweek (#202). Not which
 *  gameweeks have begun: that is `passedDeadlinesOf`. */
export async function fixedDeadlinesOf(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Map<number, number>> {
  const kept = await takeAllOrThrow(
    ctx.db.query("keptDeadlines").withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", leagueId)),
    GAMEWEEKS_MOST,
    `More than ${GAMEWEEKS_MOST} kept deadlines are held for one league, so its latest dropped gameweeks' deadlines would be lost`,
  );
  return new Map([...kept.map((row): [number, number] => [row.gameweek, row.deadline]), ...(await passedDeadlinesOf(ctx, leagueId))]);
}
