import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, type QueryCtx } from "./_generated/server";
import { callerEmail, isAdmin, refuse, refusals } from "./leagueAccess";
import { leaguesOf, type LeagueSummary } from "./myLeagues";

// The league switcher (#76, spec/13, Several leagues): the app opens the league a person used
// last. It is kept on the server, by email, so it follows them to every device.

/** Having a part in a league is a role in it (`leaguesOf`), which the admin's override alone isn't. */
const hasPart = (league: LeagueSummary) => league.roles.length > 0;

const rememberedRow = (ctx: QueryCtx, email: string) =>
  ctx.db
    .query("lastLeagues")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();

/** The league the app is in: the one used last while the person still has a part in it, or else
 *  the first of theirs by name, or null when they have a part in none. A league being deleted is
 *  never it (#75). `leagues` are theirs, by name (`leaguesOf`), the admin's partless ones among them. */
export async function currentLeagueOf(ctx: QueryCtx, email: string, leagues: readonly LeagueSummary[]): Promise<Id<"leagues"> | null> {
  const theirs = leagues.filter((league) => hasPart(league) && !league.deletion);
  const remembered = await rememberedRow(ctx, email);
  const current = theirs.find((league) => league.leagueId === remembered?.leagueId) ?? theirs[0];
  return current?.leagueId ?? null;
}

/** The person switches to one of their leagues, which the app then opens until they switch again. */
export const switchTo = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const email = await callerEmail(ctx);
    const theirs = (await leaguesOf(ctx, email, isAdmin(email))).filter(hasPart);
    const league = theirs.find((each) => each.leagueId === leagueId) ?? refuse(refusals.notYourLeague);
    if (league.deletion) refuse(refusals.beingDeleted);

    const remembered = await rememberedRow(ctx, email);
    if (!remembered) await ctx.db.insert("lastLeagues", { email, leagueId });
    else if (remembered.leagueId !== leagueId) await ctx.db.patch("lastLeagues", remembered._id, { leagueId });
    return null;
  },
});
