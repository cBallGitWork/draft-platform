import { v } from "convex/values";
import { query } from "./_generated/server";
import { currentLeagueOf } from "./lastLeague";
import { isAdmin, signedInEmail } from "./leagueAccess";
import { leagueSummary, leaguesOf } from "./myLeagues";

/** Who this browser is signed in as, or null when signed out, their leagues (spec/12), and the one
 *  the app is in (#76): in a league is having a part in one, which the admin's override alone isn't. */
export const signedInAs = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      email: v.string(),
      isAdmin: v.boolean(),
      inLeague: v.boolean(),
      leagues: v.array(leagueSummary),
      currentLeagueId: v.union(v.id("leagues"), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const email = await signedInEmail(ctx);
    if (email === null) return null;
    const admin = isAdmin(email);
    const leagues = await leaguesOf(ctx, email, admin);
    const currentLeagueId = await currentLeagueOf(ctx, email, leagues);
    return { email, isAdmin: admin, inLeague: currentLeagueId !== null, leagues, currentLeagueId };
  },
});
