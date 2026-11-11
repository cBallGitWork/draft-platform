import { v } from "convex/values";
import { query } from "../_generated/server";
import { firstKickoffs as firstKickoffsOf } from "../gameweeks/gameweekStarts";
import { seasonGameweekCount } from "../gameweeks/seasonGameweeks";
import { currentFixtures } from "../shared/fixtures";
import { callerEmail } from "../shared/leagueAccess";

// When each of the Premier League's gameweeks kicks off, for the section's fixtures and results
// (#49; spec/18: "opening on the current gameweek"). Which gameweek is current turns on the clock,
// which a query must not read (convex/_generated/ai/guidelines.md), so the screen judges it from
// these.

const firstKickoff = v.object({ gameweek: v.number(), firstKickoff: v.number() });

/** How many gameweeks the season has (#1618), so the screen steps through them all and no
 *  further, and each gameweek's earliest kickoff among the matches the feed still sends, in gameweek
 *  order, for anyone signed in. A gameweek none of whose matches has a kickoff time is left out of
 *  the kickoffs, as is a postponed match waiting for a gameweek. */
export const firstKickoffs = query({
  args: {},
  returns: v.object({ seasonGameweeks: v.number(), firstKickoffs: v.array(firstKickoff) }),
  handler: async (ctx) => {
    await callerEmail(ctx);
    const kickoffs = [...firstKickoffsOf(await currentFixtures(ctx))]
      .map(([gameweek, kickoff]) => ({ gameweek, firstKickoff: kickoff }))
      .toSorted((one, other) => one.gameweek - other.gameweek);
    return { seasonGameweeks: await seasonGameweekCount(ctx), firstKickoffs: kickoffs };
  },
});
