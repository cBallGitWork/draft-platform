import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type QueryCtx } from "../_generated/server";
import { takeAllOrThrow } from "../shared/cappedRead";
import { teamsOf } from "../shared/leagueAccess";
import { squadOf } from "../squads/squadPlace";
import { pickFirstLineupAgain } from "./lineups";

// The one-off migration for #637: a team whose players joined before teams held a first lineup
// has no lineup row, so it would field nobody once the next deadline passes. This gives each such
// team its first lineup (lineups.ts `pickFirstLineupAgain`), from the next gameweek not yet begun:
// a gameweek begun stays as it was scored (spec/09: games played in the past are done). A team
// with any lineup row, or with nobody in its squad, is left alone, so running it again does
// nothing. Run it once on each deployment, before the next deadline: run after one, such a team
// holds nobody in the gameweek just begun and scores 0 there, and gets its lineup from the next.
//   npx convex run lineup/firstLineupBackfill:giveTeamsTheirFirstLineup
//   npx convex run --prod lineup/firstLineupBackfill:giveTeamsTheirFirstLineup

/** The most leagues one run reads, all in one transaction: Claude's sizing for the closed beta,
 *  which has a handful, each team reading its lineup rows, squad and positions. Well short of it
 *  Convex's own read limit may stop the run, which then writes nothing and says so. Past it this
 *  throws, rather than leave some teams without a lineup. */
const LEAGUES_BACKFILLED_MOST = 200;

/** Whether the team has any lineup row, from any gameweek. */
async function hasLineupRow(ctx: QueryCtx, leagueId: Id<"leagues">, teamId: Id<"teams">): Promise<boolean> {
  const row = await ctx.db
    .query("lineups")
    .withIndex("by_leagueId_and_teamId_and_fromGameweek", (q) => q.eq("leagueId", leagueId).eq("teamId", teamId))
    .first();
  return row !== null;
}

/** Gives every team with players and no lineup row its first lineup; returns the teams given one. */
export const giveTeamsTheirFirstLineup = internalMutation({
  args: {},
  returns: v.object({ teamsGiven: v.array(v.id("teams")) }),
  handler: async (ctx) => {
    const leagues = await takeAllOrThrow(
      ctx.db.query("leagues"),
      LEAGUES_BACKFILLED_MOST,
      `More than ${LEAGUES_BACKFILLED_MOST} leagues are held, so some teams would be left without a lineup`,
    );
    const teamsGiven: Id<"teams">[] = [];
    for (const league of leagues) {
      for (const team of await teamsOf(ctx, league._id)) {
        if (await hasLineupRow(ctx, league._id, team._id)) continue;
        if ((await squadOf(ctx, team._id)).length === 0) continue;
        await pickFirstLineupAgain(ctx, league._id, team._id);
        // Nothing is written for a league with no rules or once the season is over.
        if (await hasLineupRow(ctx, league._id, team._id)) teamsGiven.push(team._id);
      }
    }
    return { teamsGiven };
  },
});
