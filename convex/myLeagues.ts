import { v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { teamsOf } from "./leagueAccess";
import { noLinkReply } from "./signInLinks";

// "Your leagues" (spec/12): each league the signed-in person has a part in, or, for the admin, who
// keeps an override on every league (spec/15), every league.

/** The most leagues one list shows, and of each kind of part in one: the closed beta has a handful. */
const LEAGUES_SHOWN = 200;

export const leagueRole = v.union(v.literal("commissioner"), v.literal("co-commissioner"), v.literal("manager"));

export const leagueSummary = v.object({
  leagueId: v.id("leagues"),
  name: v.string(),
  commissionerEmail: v.string(),
  /** The person's parts in it; none for the admin in a league he has no part in. */
  roles: v.array(leagueRole),
  /** The team the person runs here, or null. */
  teamName: v.union(v.string(), v.null()),
  teams: v.number(),
  maxTeams: v.number(),
  /** For the admin only: what asking for the commissioner's sign-in link answered, when that
   *  wasn't "check your email", so a link that never went is seen. */
  unsentCommissionerLink: v.union(v.null(), v.object({ email: v.string(), reply: noLinkReply })),
});
export type LeagueSummary = Infer<typeof leagueSummary>;

export async function leaguesOf(ctx: QueryCtx, email: string, isAdmin: boolean): Promise<LeagueSummary[]> {
  const commissioned = await ctx.db
    .query("leagues")
    .withIndex("by_commissionerEmail", (q) => q.eq("commissionerEmail", email))
    .take(LEAGUES_SHOWN);
  const coCommissioned = await ctx.db
    .query("leagues")
    .withIndex("by_coCommissionerEmail", (q) => q.eq("coCommissionerEmail", email))
    .take(LEAGUES_SHOWN);
  const managed = await ctx.db
    .query("teams")
    .withIndex("by_managerEmail", (q) => q.eq("managerEmail", email))
    .take(LEAGUES_SHOWN);

  const leagues = new Map<Id<"leagues">, Doc<"leagues">>();
  for (const league of [...commissioned, ...coCommissioned]) leagues.set(league._id, league);
  for (const team of managed) {
    const league = await ctx.db.get("leagues", team.leagueId);
    if (!league) throw new Error(`Team ${team._id} is in league ${team.leagueId}, which doesn't exist`);
    leagues.set(league._id, league);
  }
  if (isAdmin) for (const league of await ctx.db.query("leagues").take(LEAGUES_SHOWN)) leagues.set(league._id, league);

  const summaries = [];
  for (const league of leagues.values()) {
    const teams = await teamsOf(ctx, league._id);
    const team = teams.find((each) => each.managerEmail === email);
    const roles: LeagueSummary["roles"] = [];
    if (league.commissionerEmail === email) roles.push("commissioner");
    if (league.coCommissionerEmail === email) roles.push("co-commissioner");
    if (team) roles.push("manager");
    const link = isAdmin ? league.commissionerLink : undefined;
    summaries.push({
      leagueId: league._id,
      name: league.name,
      commissionerEmail: league.commissionerEmail,
      roles,
      teamName: team?.name ?? null,
      teams: teams.length,
      maxTeams: league.maxTeams,
      unsentCommissionerLink: link && link.reply !== "checkYourEmail" ? { email: link.email, reply: link.reply } : null,
    });
  }
  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}
