import { v } from "convex/values";
import { query } from "../_generated/server";
import { currentLeagueOf } from "../leagues/lastLeague";
import { isAdmin, signedInEmail } from "../shared/leagueAccess";
import { leagueSummary, leaguesOf } from "../leagues/myLeagues";

/** Who this browser is signed in as, or null when signed out, their leagues (spec/12), and the one
 *  the app is in (#76): in a league is having a part in one not being deleted, which the admin's
 *  override alone isn't. */
export const signedInAs = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      email: v.string(),
      isAdmin: v.boolean(),
      inLeague: v.boolean(),
      leagues: v.array(leagueSummary),
      /** Only when the list stops short: more leagues exist than `leagues` holds. */
      leaguesCut: v.optional(v.literal(true)),
      currentLeagueId: v.union(v.id("leagues"), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const email = await signedInEmail(ctx);
    if (email === null) return null;
    const admin = isAdmin(email);
    const { leagues, cut } = await leaguesOf(ctx, email);
    const currentLeagueId = await currentLeagueOf(ctx, email, leagues);
    return { email, isAdmin: admin, inLeague: currentLeagueId !== null, leagues, ...(cut && { leaguesCut: true as const }), currentLeagueId };
  },
});
