import { v } from "convex/values";
import { query } from "./_generated/server";
import { adminEmail } from "./allowedEmails";
import { signedInEmail } from "./leagueAccess";
import { leagueSummary, leaguesOf } from "./myLeagues";

/** Who this browser is signed in as, or null when signed out, and their leagues (spec/12): in a
 *  league is having a part in one, which the admin's override alone isn't. */
export const signedInAs = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ email: v.string(), isAdmin: v.boolean(), inLeague: v.boolean(), leagues: v.array(leagueSummary) }),
  ),
  handler: async (ctx) => {
    const email = await signedInEmail(ctx);
    if (email === null) return null;
    const isAdmin = email === adminEmail();
    const leagues = await leaguesOf(ctx, email, isAdmin);
    return { email, isAdmin, inLeague: leagues.some((league) => league.roles.length > 0), leagues };
  },
});
