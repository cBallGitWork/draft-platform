import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation, type QueryCtx } from "../_generated/server";
import { callerEmail, refuse, refusals } from "../shared/leagueAccess";
import { leaguesOf, type LeagueSummary } from "./myLeagues";

// The league switcher (#76, spec/13, Several leagues): the app opens the league a person used
// last. It is kept on the server, by email, so it follows them to every device.

/** Having a part in a league is a role in it (`leaguesOf`), which the admin's override alone isn't. */
const hasPart = (league: LeagueSummary) => league.roles.length > 0;

/** The leagues a person can be in and switch between, in `leagues`' order: those they have a part
 *  in that aren't being deleted, which freezes a league even for whoever is deleting it (#75). The
 *  one rule for the league the app is in, the switcher's list, which signIn/account:signedInAs
 *  sends (#207), and the leagues `switchTo` lets them switch to (#488). */
export const switchableLeagues = (leagues: readonly LeagueSummary[]): LeagueSummary[] =>
  leagues.filter((league) => hasPart(league) && !league.deletion);

const rememberedRow = (ctx: QueryCtx, email: string) =>
  ctx.db
    .query("lastLeagues")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();

/** The league the app is in: the one used last while it is still among their `switchableLeagues`,
 *  or else the first of those by name, or null when there are none. `leagues` are theirs, by name
 *  (`leaguesOf`), the admin's partless ones among them. */
export async function currentLeagueOf(ctx: QueryCtx, email: string, leagues: readonly LeagueSummary[]): Promise<Id<"leagues"> | null> {
  const theirs = switchableLeagues(leagues);
  const remembered = await rememberedRow(ctx, email);
  const current = theirs.find((league) => league.leagueId === remembered?.leagueId) ?? theirs[0];
  return current?.leagueId ?? null;
}

/** The person switches to one of the leagues their switcher lists, their `switchableLeagues`, which
 *  the app then opens until they switch again. Any other is refused: as being deleted when they
 *  have a part in it and are shown that it is (`leaguesOf` shows it to its commissioner and the
 *  admin alone), and otherwise as one they aren't in. */
export const switchTo = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const email = await callerEmail(ctx);
    const { leagues } = await leaguesOf(ctx, email);
    if (!switchableLeagues(leagues).some((league) => league.leagueId === leagueId)) {
      const league = leagues.find((theirs) => theirs.leagueId === leagueId);
      refuse(league && hasPart(league) && league.deletion ? refusals.beingDeleted : refusals.notInLeague);
    }

    const remembered = await rememberedRow(ctx, email);
    if (!remembered) await ctx.db.insert("lastLeagues", { email, leagueId });
    else if (remembered.leagueId !== leagueId) await ctx.db.patch("lastLeagues", remembered._id, { leagueId });
    return null;
  },
});
