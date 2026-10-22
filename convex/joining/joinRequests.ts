import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalMutation, mutation, query, type QueryCtx } from "../_generated/server";
import { sendEmail } from "../email/email";
import { startOfNextDay, takeTodaysEmail } from "../email/emailLimit";
import { linkWithToken } from "./inviteLink";
import { joiningRefusals } from "./joining";
import { approvedEmail } from "./joiningEmails";
import { callerEmail, getLeague, refuse, runnerOf, signedInEmail, teamOf } from "../shared/leagueAccess";
import { recordEvent } from "../mail/letters";
import { delivery } from "../schema";
import { putOnTeam } from "../leagues/teams";

// Join requests (#73; spec/13 Joining, spec/15 Joining a league): a person who opens the invite
// link asks to join. They have at most one request waiting in a league; its runners approve it,
// picking the team, a vacated one included, or refuse it, which files no Mail letter. An approved
// person gets an email.

/** The person's request waiting in this league, if any. */
function waitingRequestOf(ctx: QueryCtx, leagueId: Id<"leagues">, email: string) {
  return ctx.db
    .query("joinRequests")
    .withIndex("by_leagueId_and_email_and_decision", (q) => q.eq("leagueId", leagueId).eq("email", email).eq("decision", undefined))
    .first();
}

/** What the invite link's page shows: whether the person may ask, has asked and waits, or runs a
 *  team in the league already; null once the link no longer works, or while the league is being
 *  deleted (spec/13 hides it then). */
export const joinPageData = v.union(
  v.null(),
  v.object({ leagueName: v.string(), standing: v.union(v.literal("mayAsk"), v.literal("waiting")) }),
  v.object({ leagueName: v.string(), standing: v.literal("inLeague"), teamName: v.string() }),
);
export type JoinPageData = Infer<typeof joinPageData>;

export const joinPage = query({
  args: { token: v.string() },
  returns: joinPageData,
  handler: async (ctx, { token }) => {
    const link = await linkWithToken(ctx, token);
    const league = link && (await ctx.db.get("leagues", link.leagueId));
    if (!league || league.deletion) return null;
    const email = await signedInEmail(ctx);
    if (email === null) return { leagueName: league.name, standing: "mayAsk" as const };
    const team = await teamOf(ctx, league._id, email);
    if (team) return { leagueName: league.name, standing: "inLeague" as const, teamName: team.name };
    const waiting = await waitingRequestOf(ctx, league._id, email);
    return { leagueName: league.name, standing: waiting ? ("waiting" as const) : ("mayAsk" as const) };
  },
});

/** Asks to join the invite link's league. Asking again while one waits changes nothing. */
export const ask = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    const email = await callerEmail(ctx);
    const link = (await linkWithToken(ctx, token)) ?? refuse(joiningRefusals.linkOff);
    await getLeague(ctx, link.leagueId);
    if (await teamOf(ctx, link.leagueId, email)) refuse(joiningRefusals.alreadyIn);
    if (await waitingRequestOf(ctx, link.leagueId, email)) return null;
    await ctx.db.insert("joinRequests", { leagueId: link.leagueId, email });
    return null;
  },
});

/** The request, if it waits and the caller may run its league. */
async function waitingRequestToDecide(ctx: QueryCtx, requestId: Id<"joinRequests">) {
  const request = (await ctx.db.get("joinRequests", requestId)) ?? refuse(joiningRefusals.noRequest);
  const { email: by, league } = await runnerOf(ctx, request.leagueId);
  if (request.decision !== undefined) refuse(joiningRefusals.requestDecided);
  return { by, league, request };
}

/** Approves the request, making the person the manager of the vacated team `teamId`, or of a new
 *  team, and emails them. */
export const approve = mutation({
  args: { requestId: v.id("joinRequests"), teamId: v.optional(v.id("teams")) },
  returns: v.null(),
  handler: async (ctx, { requestId, teamId }) => {
    const { by, league, request } = await waitingRequestToDecide(ctx, requestId);
    const joined = await putOnTeam(ctx, league, request.email, teamId);
    await ctx.db.patch("joinRequests", requestId, { decision: "approved", decidedBy: by, approvedEmail: "sending" });
    await recordEvent(ctx, league._id, by, { kind: "joinRequestApproved", email: request.email, ...joined });
    await ctx.scheduler.runAfter(0, internal.joining.joinRequests.sendApprovedEmail, { requestId, teamName: joined.teamName });
    return null;
  },
});

/** Refuses the request. It files nothing for Mail (spec/13), and the person may ask again. */
export const refuseRequest = mutation({
  args: { requestId: v.id("joinRequests") },
  returns: v.null(),
  handler: async (ctx, { requestId }) => {
    const { by } = await waitingRequestToDecide(ctx, requestId);
    await ctx.db.patch("joinRequests", requestId, { decision: "refused", decidedBy: by });
    return null;
  },
});

const approvedEmailArgs = { requestId: v.id("joinRequests"), teamName: v.string() };

/** Emails the approved person, unless the day's emails are all gone: then it waits for tomorrow. */
export const sendApprovedEmail = internalAction({
  args: approvedEmailArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const to: { email: string; leagueName: string } | null = await ctx.runMutation(internal.joining.joinRequests.takeEmailFor, args);
    if (to === null) return null;
    try {
      await sendEmail(to.email, approvedEmail({ leagueName: to.leagueName, teamName: args.teamName }));
      await ctx.runMutation(internal.joining.joinRequests.recordApprovedEmail, { requestId: args.requestId, delivery: "sent" });
    } catch (error) {
      console.error(`The email telling ${to.email} they're in ${to.leagueName} wasn't sent:`, error);
      await ctx.runMutation(internal.joining.joinRequests.recordApprovedEmail, { requestId: args.requestId, delivery: "notSent" });
    }
    return null;
  },
});

/** Takes one of today's emails for the approved person, or, with none left, sets it waiting for
 *  tomorrow; whom it goes to, or null when it waits or went with its deleted league. */
export const takeEmailFor = internalMutation({
  args: approvedEmailArgs,
  returns: v.union(v.null(), v.object({ email: v.string(), leagueName: v.string() })),
  handler: async (ctx, args) => {
    const request = await ctx.db.get("joinRequests", args.requestId);
    const league = request && (await ctx.db.get("leagues", request.leagueId));
    if (!request || !league) return null;
    if (await takeTodaysEmail(ctx)) return { email: request.email, leagueName: league.name };
    await ctx.db.patch("joinRequests", args.requestId, { approvedEmail: "waiting" });
    await ctx.scheduler.runAt(startOfNextDay(Date.now()), internal.joining.joinRequests.sendApprovedEmail, args);
    return null;
  },
});

export const recordApprovedEmail = internalMutation({
  args: { requestId: v.id("joinRequests"), delivery },
  returns: v.null(),
  handler: async (ctx, { requestId, delivery }) => {
    await ctx.db.patch("joinRequests", requestId, { approvedEmail: delivery });
    return null;
  },
});
