import { v } from "convex/values";
import { query } from "../_generated/server";
import { currentLeagueOf, switchableLeagues } from "../leagues/lastLeague";
import { isAdmin, signedInEmail } from "../shared/leagueAccess";
import { leagueSummary, leaguesOf } from "../leagues/myLeagues";

/** Who this browser is signed in as, or null when signed out, their leagues (spec/12), those the
 *  league switcher offers, and the one the app is in (#76), always one of those: in a league is
 *  having a part in one not being deleted, which the admin's override alone isn't. One rule,
 *  leagues/lastLeague.ts's `switchableLeagues`, judges both (#207). */
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
      /** Of `leagues`, in its order, those the switcher offers. */
      switchableLeagueIds: v.array(v.id("leagues")),
      currentLeagueId: v.union(v.id("leagues"), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const email = await signedInEmail(ctx);
    if (email === null) return null;
    const admin = isAdmin(email);
    const { leagues, cut } = await leaguesOf(ctx, email);
    const switchableLeagueIds = switchableLeagues(leagues).map((league) => league.leagueId);
    const currentLeagueId = await currentLeagueOf(ctx, email, leagues);
    return {
      email,
      isAdmin: admin,
      inLeague: currentLeagueId !== null,
      leagues,
      ...(cut && { leaguesCut: true as const }),
      switchableLeagueIds,
      currentLeagueId,
    };
  },
});
