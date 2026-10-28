import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { isAdmin, leaguePowers, leagueRole, powersIn, rolesIn, seesWhileDeleted, teamsOf } from "../shared/leagueAccess";
import { leagueDeletion } from "../schema";
import { LEAGUES_SHOWN } from "./leagueLimits";
import { hasOpenedALink } from "../signIn/signInLinks";
import { noLinkReply } from "../signIn/signInReplies";

// "Your leagues" (spec/12): each league the signed-in person has a part in, or, for the admin, who
// keeps an override on every league (spec/15), every league.

export const leagueSummary = v.object({
  leagueId: v.id("leagues"),
  name: v.string(),
  commissionerEmail: v.string(),
  /** The person's parts in it; none for the admin in a league he has no part in. */
  roles: v.array(leagueRole),
  /** What the person may do in it, as the server judges every change (powersIn), so a screen
   *  offers a way in only to who may use it. */
  powers: leaguePowers,
  /** The team the person runs here, or null. */
  teamName: v.union(v.string(), v.null()),
  teams: v.number(),
  maxTeams: v.number(),
  /** For the admin only: what asking for the commissioner's sign-in link answered, when that
   *  wasn't "check your email" and they haven't signed in since, so a link that never went is seen. */
  unsentCommissionerLink: v.union(v.null(), v.object({ email: v.string(), reply: noLinkReply })),
  /** While it is being deleted (#75), which only its commissioner and the admin see: when it
   *  goes. */
  deletion: v.optional(leagueDeletion.pick("deletesAt")),
});
export type LeagueSummary = Infer<typeof leagueSummary>;

/** The commissioner's link that didn't go, until they sign in some other way. */
async function unsentLinkOf(ctx: QueryCtx, league: Doc<"leagues">): Promise<LeagueSummary["unsentCommissionerLink"]> {
  const link = league.commissionerLink;
  if (!link || link.reply === "checkYourEmail") return null;
  return (await hasOpenedALink(ctx, link.email)) ? null : { email: link.email, reply: link.reply };
}

/** A person's leagues by name, and whether any read of them held more than LEAGUES_SHOWN, so some
 *  are missing from `leagues`. */
export type LeagueList = { leagues: LeagueSummary[]; cut: boolean };

export async function leaguesOf(ctx: QueryCtx, email: string): Promise<LeagueList> {
  let cut = false;
  /** The first LEAGUES_SHOWN rows, noting whether there were more. */
  async function shown<Row>(rows: { take(count: number): Promise<Row[]> }): Promise<Row[]> {
    const taken = await rows.take(LEAGUES_SHOWN + 1);
    if (taken.length > LEAGUES_SHOWN) cut = true;
    return taken.slice(0, LEAGUES_SHOWN);
  }
  const commissioned = await shown(ctx.db.query("leagues").withIndex("by_commissionerEmail", (q) => q.eq("commissionerEmail", email)));
  const coCommissioned = await shown(ctx.db.query("leagues").withIndex("by_coCommissionerEmail", (q) => q.eq("coCommissionerEmail", email)));
  const managed = await shown(ctx.db.query("teams").withIndex("by_managerEmail", (q) => q.eq("managerEmail", email)));

  const admin = isAdmin(email);
  const leagues = new Map<Id<"leagues">, Doc<"leagues">>();
  for (const league of [...commissioned, ...coCommissioned]) leagues.set(league._id, league);
  for (const team of managed) {
    const league = await ctx.db.get("leagues", team.leagueId);
    if (!league) throw new Error(`Team ${team._id} is in league ${team.leagueId}, which doesn't exist`);
    leagues.set(league._id, league);
  }
  if (admin) for (const league of await shown(ctx.db.query("leagues"))) leagues.set(league._id, league);

  const summaries = [];
  for (const league of leagues.values()) {
    const { deletion } = league;
    if (deletion && !seesWhileDeleted(league, email)) continue;
    const teams = await teamsOf(ctx, league._id);
    const team = teams.find((each) => each.managerEmail === email);
    summaries.push({
      leagueId: league._id,
      name: league.name,
      commissionerEmail: league.commissionerEmail,
      roles: rolesIn(league, email, team),
      powers: powersIn(league, email),
      teamName: team?.name ?? null,
      teams: teams.length,
      maxTeams: league.maxTeams,
      unsentCommissionerLink: admin ? await unsentLinkOf(ctx, league) : null,
      deletion: deletion && { deletesAt: deletion.deletesAt },
    });
  }
  return { leagues: summaries.sort((a, b) => a.name.localeCompare(b.name)), cut };
}
