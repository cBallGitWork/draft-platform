import { ConvexError, v, type Infer } from "convex/values";
import { query } from "../_generated/server";
import { linkOf } from "./inviteLink";
import { runnerOf, teamsOf } from "../shared/leagueAccess";
import { delivery } from "../schema";

// The page where a league's runners invite people and answer join requests (#73, spec/13
// Joining). No wall clock here: the screen tells an expired invite by its `expiresAt`.

/** The most invites and waiting requests the page lists, newest first: the closed beta's leagues
 *  are small. */
export const ROWS_SHOWN = 50;

const invitesPageData = v.union(
  v.null(),
  v.object({
    leagueId: v.id("leagues"),
    leagueName: v.string(),
    /** Each team and its manager, null while it is vacated: an invite or an approval can name a
     *  vacated team, and a managed team's manager can be removed. */
    teams: v.array(v.object({ teamId: v.id("teams"), name: v.string(), managerEmail: v.union(v.string(), v.null()) })),
    /** Whether the league is under its maximum, so a new team can be made. */
    hasRoom: v.boolean(),
    /** The live invite link's token, or null while it has none. */
    linkToken: v.union(v.string(), v.null()),
    /** Every invite not cancelled. */
    invites: v.array(
      v.object({
        inviteId: v.id("invites"),
        email: v.string(),
        /** The vacated team it names, or null for a new team. */
        teamName: v.union(v.string(), v.null()),
        delivery,
        expiresAt: v.number(),
        /** The team they joined on signing in, or why they couldn't, once they did. */
        joinedTeamName: v.union(v.string(), v.null()),
        couldNotJoin: v.union(v.string(), v.null()),
      }),
    ),
    /** The join requests waiting for an answer. */
    requests: v.array(v.object({ requestId: v.id("joinRequests"), email: v.string(), askedAt: v.number() })),
  }),
);
export type InvitesPageData = NonNullable<Infer<typeof invitesPageData>>;

/** The page's data, or null when the league doesn't exist or the caller doesn't run it. */
export const page = query({
  args: { leagueId: v.string() },
  returns: invitesPageData,
  handler: async (ctx, args) => {
    const leagueId = ctx.db.normalizeId("leagues", args.leagueId);
    if (leagueId === null) return null;
    let league;
    try {
      ({ league } = await runnerOf(ctx, leagueId));
    } catch (error) {
      // A refusal (signed out, no such league, not a runner) is what null means here.
      if (error instanceof ConvexError) return null;
      throw error;
    }

    const teams = await teamsOf(ctx, leagueId);
    const teamName = new Map(teams.map((team) => [team._id, team.name]));
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_leagueId_and_cancelledAt", (q) => q.eq("leagueId", leagueId).eq("cancelledAt", undefined))
      .order("desc")
      .take(ROWS_SHOWN);
    const requests = await ctx.db
      .query("joinRequests")
      .withIndex("by_leagueId_and_decision", (q) => q.eq("leagueId", leagueId).eq("decision", undefined))
      .order("desc")
      .take(ROWS_SHOWN);

    return {
      leagueId,
      leagueName: league.name,
      teams: teams.map((team) => ({ teamId: team._id, name: team.name, managerEmail: team.managerEmail ?? null })),
      hasRoom: teams.length < league.maxTeams,
      linkToken: (await linkOf(ctx, leagueId))?.token ?? null,
      invites: invites.map((invite) => ({
        inviteId: invite._id,
        email: invite.email,
        teamName: invite.teamId === undefined ? null : (teamName.get(invite.teamId) ?? null),
        delivery: invite.delivery,
        expiresAt: invite.expiresAt,
        joinedTeamName: invite.joined?.teamName ?? null,
        couldNotJoin: invite.couldNotJoin ?? null,
      })),
      requests: requests.map((request) => ({ requestId: request._id, email: request.email, askedAt: request._creationTime })),
    };
  },
});
