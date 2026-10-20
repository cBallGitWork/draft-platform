import { v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { teamsOf } from "./leagueAccess";
import { leagueDeletion } from "./schema";
import { noLinkReply } from "./signInLinks";

// "Your leagues" (spec/12): each league the signed-in person has a part in, or, for the admin, who
// keeps an override on every league (spec/15), every league.

/** The most leagues one list shows, and of each kind of part in one: the closed beta has a handful. */
const LEAGUES_SHOWN = 200;

const leagueRole = v.union(v.literal("commissioner"), v.literal("co-commissioner"), v.literal("manager"));

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
   *  wasn't "check your email" and they haven't signed in since, so a link that never went is seen. */
  unsentCommissionerLink: v.union(v.null(), v.object({ email: v.string(), reply: noLinkReply })),
  /** While it is being deleted (#75), which only whoever deleted it and the admin see: when it
   *  goes, and who wasn't emailed. */
  deletion: v.optional(leagueDeletion.pick("deletesAt", "unemailed")),
});
export type LeagueSummary = Infer<typeof leagueSummary>;

/** The commissioner's link that didn't go, until they sign in some other way. Convex Auth makes
 *  their user even when the link fails, and marks it verified only once a link of theirs is opened. */
async function unsentLinkOf(ctx: QueryCtx, league: Doc<"leagues">): Promise<LeagueSummary["unsentCommissionerLink"]> {
  const link = league.commissionerLink;
  if (!link || link.reply === "checkYourEmail") return null;
  const user = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", link.email))
    .first();
  return user?.emailVerificationTime === undefined ? { email: link.email, reply: link.reply } : null;
}

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
    const { deletion } = league;
    if (deletion && deletion.by !== email && !isAdmin) continue;
    const teams = await teamsOf(ctx, league._id);
    const team = teams.find((each) => each.managerEmail === email);
    const roles: LeagueSummary["roles"] = [];
    if (league.commissionerEmail === email) roles.push("commissioner");
    if (league.coCommissionerEmail === email) roles.push("co-commissioner");
    if (team) roles.push("manager");
    summaries.push({
      leagueId: league._id,
      name: league.name,
      commissionerEmail: league.commissionerEmail,
      roles,
      teamName: team?.name ?? null,
      teams: teams.length,
      maxTeams: league.maxTeams,
      unsentCommissionerLink: isAdmin ? await unsentLinkOf(ctx, league) : null,
      deletion: deletion && { deletesAt: deletion.deletesAt, unemailed: deletion.unemailed },
    });
  }
  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}
