import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { MOST_TEAMS } from "../leagues/leagueLimits";
import { takeAllOrThrow } from "../shared/cappedRead";
import type { Stats } from "./statTotals";

// The read of each team's season totals for the stat race (#800, spec/19), apart from the writes
// that keep them (teamSeasonStats.ts).

/** Each of the league's teams' season totals, by team. A team with none held has had nothing
 *  counted yet. */
export async function teamTotals(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Map<Id<"teams">, Stats>> {
  const rows = await takeAllOrThrow(
    ctx.db.query("teamSeasonStats").withIndex("by_leagueId_and_teamId", (q) => q.eq("leagueId", leagueId)),
    MOST_TEAMS,
    `League ${leagueId} holds more than ${MOST_TEAMS} teams' stat totals, so some would be left out`,
  );
  return new Map(rows.map((row) => [row.teamId, row.stats]));
}
