import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, type QueryCtx } from "./_generated/server";
import { callerEmail, refuse, teamsOf } from "./leagueAccess";
import type { LeagueSummary } from "./myLeagues";

// The league switcher (#76, spec/13, Several leagues): the app opens the league a person used
// last. It is kept on the server, by email, so it follows them to every device.

/** Why a switch was refused, as the person switching is told it. */
export const notYourLeague = "You're not in that league.";

const rememberedRow = (ctx: QueryCtx, email: string) =>
  ctx.db
    .query("lastLeagues")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();

/** The league the app is in: the one used last while the person still has a part in it, or else
 *  the first of theirs by name, or null when they have a part in none. `leagues` are theirs, by
 *  name (`leaguesOf`), the admin's partless ones among them. */
export async function currentLeagueOf(ctx: QueryCtx, email: string, leagues: readonly LeagueSummary[]): Promise<Id<"leagues"> | null> {
  const theirs = leagues.filter((league) => league.roles.length > 0);
  const remembered = await rememberedRow(ctx, email);
  return (theirs.find((league) => league.leagueId === remembered?.leagueId) ?? theirs[0])?.leagueId ?? null;
}

/** The person switches to one of their leagues, which the app then opens until they switch again. */
export const switchTo = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const email = await callerEmail(ctx);
    const league = await ctx.db.get("leagues", leagueId);
    const hasPart =
      league !== null &&
      (league.commissionerEmail === email ||
        league.coCommissionerEmail === email ||
        (await teamsOf(ctx, leagueId)).some((team) => team.managerEmail === email));
    if (!hasPart) refuse(notYourLeague);

    const remembered = await rememberedRow(ctx, email);
    if (!remembered) await ctx.db.insert("lastLeagues", { email, leagueId });
    else if (remembered.leagueId !== leagueId) await ctx.db.patch("lastLeagues", remembered._id, { leagueId });
    return null;
  },
});
