import { v } from "convex/values";
import { query } from "../_generated/server";
import { takeAllOrThrow } from "../shared/cappedRead";
import { memberOf, teamIn } from "../shared/leagueAccess";

// The awards a team has won, for its page (spec/09, Awards, S09.8; #2680): each month it was
// Manager of the Month (awards.ts), oldest first.

/** The most awards one league's read takes: one a month, ten seasons of them. Past it the read
 *  throws rather than leave one out. Claude's sizing, not Craig's. */
export const AWARDS_READ_MOST = 120;

/** The months, as "2026-10", the team was Manager of the Month in, oldest first. Anyone in the
 *  league may read them; a team outside it is refused. */
export const ofTeam = query({
  args: { leagueId: v.id("leagues"), teamId: v.id("teams") },
  returns: v.array(v.string()),
  handler: async (ctx, { leagueId, teamId }) => {
    await memberOf(ctx, leagueId);
    await teamIn(ctx, leagueId, teamId);
    const awards = await takeAllOrThrow(
      ctx.db.query("awards").withIndex("by_leagueId_and_month", (q) => q.eq("leagueId", leagueId)),
      AWARDS_READ_MOST,
      `The league has more than ${AWARDS_READ_MOST} awards, so a team's page can't list them all.`,
    );
    return awards.filter((award) => award.teamId === teamId).map((award) => award.month);
  },
});
