import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { startingColours } from "../leagues/teamColours";
import { everyLeague } from "../shared/cappedRead";
import { teamsOf } from "../shared/leagueAccess";

// The one-off migration for #2684: a team made before team colours gets its random start, as a
// new team does (spec/12 S12.33), in the order the teams were made. A team holding colours keeps
// them, so running it again does nothing. Run it once on each deployment:
//   npx convex run migrations/teamColoursBackfill:giveTeamsColours
//   npx convex run --prod migrations/teamColoursBackfill:giveTeamsColours

/** Gives each team with no colours its random start; returns how many it gave. */
export const giveTeamsColours = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    let given = 0;
    for (const league of await everyLeague(ctx, "so some teams would stay without colours")) {
      const teams = (await teamsOf(ctx, league._id)).sort((a, b) => a.number - b.number);
      for (const team of teams) {
        if (team.colours !== undefined) continue;
        // Every other team's colours count, those given just now included, so no two share a first.
        team.colours = startingColours(teams, Math.random);
        await ctx.db.patch("teams", team._id, { colours: team.colours });
        given += 1;
      }
    }
    return given;
  },
});
