import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type QueryCtx } from "../_generated/server";
import { draftIsLive, draftOf } from "../draft/draftRow";
import { FINAL_SCORES_MOST } from "../gameweekScorer/storedScores";
import { LEAGUES_READ_MOST, takeAllOrThrow } from "../shared/cappedRead";
import { teamsOf } from "../shared/leagueAccess";
import { squadOf } from "../squads/squadPlace";
import { pickFirstLineupAgain, saveFirstLineup } from "./lineups";

// The one-off migration for #637 and #1040: every team with players gets a saved lineup, as the
// draft's end now gives it one (draftPicks.ts), and no score moves.
// - A team whose players joined before teams held a first lineup has no lineup row, so it gets
//   its first lineup (lineups.ts `pickFirstLineupAgain`) from the next gameweek not yet begun,
//   which is the lineup it scores there today. A gameweek begun stays as it was scored (spec/09:
//   games played in the past are done): such a team holds its squad on the bench there.
// - Its first lineup is then saved (lineups.ts `saveFirstLineup`), as it stands, unless its
//   league's draft is still to come or under way, whose end saves it.
// - A final score marked as held by no lineup loses the mark; its points, 0, stay.
// A team with nobody in its squad is left alone, and running it again does nothing. Run it once
// on each deployment:
//   npx convex run lineup/firstLineupBackfill:saveTeamsTheirLineup
//   npx convex run --prod lineup/firstLineupBackfill:saveTeamsTheirLineup

/** Whether the team has any lineup row, from any gameweek. */
async function hasLineupRow(ctx: QueryCtx, leagueId: Id<"leagues">, teamId: Id<"teams">): Promise<boolean> {
  const row = await ctx.db
    .query("lineups")
    .withIndex("by_leagueId_and_teamId_and_fromGameweek", (q) => q.eq("leagueId", leagueId).eq("teamId", teamId))
    .first();
  return row !== null;
}

/** Whether the league's draft is still to come or under way: one set to start, or live. */
async function draftAhead(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<boolean> {
  const draft = await draftOf(ctx, leagueId);
  return draft !== null && (draft.started === undefined || (await draftIsLive(ctx, leagueId)));
}

/** Gives every team with players and no lineup row its first lineup and saves each first lineup
 *  as above; returns the teams given one, those whose lineup was saved, and how many final scores
 *  lost the no-lineup mark. */
export const saveTeamsTheirLineup = internalMutation({
  args: {},
  returns: v.object({ teamsGiven: v.array(v.id("teams")), teamsSaved: v.array(v.id("teams")), scoresUnmarked: v.number() }),
  handler: async (ctx) => {
    const leagues = await takeAllOrThrow(
      ctx.db.query("leagues"),
      LEAGUES_READ_MOST,
      `More than ${LEAGUES_READ_MOST} leagues are held, so some teams would be left without a lineup`,
    );
    const teamsGiven: Id<"teams">[] = [];
    const teamsSaved: Id<"teams">[] = [];
    let scoresUnmarked = 0;
    for (const league of leagues) {
      const keepFirst = await draftAhead(ctx, league._id);
      for (const team of await teamsOf(ctx, league._id)) {
        if ((await squadOf(ctx, team._id)).length === 0) continue;
        if (!(await hasLineupRow(ctx, league._id, team._id))) {
          await pickFirstLineupAgain(ctx, league._id, team._id);
          // Nothing is written for a league with no rules or once the season is over.
          if (await hasLineupRow(ctx, league._id, team._id)) teamsGiven.push(team._id);
        }
        if (!keepFirst && (await saveFirstLineup(ctx, league._id, team._id))) teamsSaved.push(team._id);
      }
      const finals = await takeAllOrThrow(
        ctx.db.query("finalScores").withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", league._id)),
        FINAL_SCORES_MOST,
        `League ${league._id} holds more than ${FINAL_SCORES_MOST} final scores, so some would keep the no-lineup mark`,
      );
      for (const row of finals) {
        if (row.noLineup === undefined) continue;
        await ctx.db.patch("finalScores", row._id, { noLineup: undefined });
        scoresUnmarked += 1;
      }
    }
    return { teamsGiven, teamsSaved, scoresUnmarked };
  },
});
