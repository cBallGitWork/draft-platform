import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalMutation, mutation, query, type QueryCtx } from "../_generated/server";
import { sendEmail } from "../outbound/email";
import { logFailure } from "../shared/errors";
import { takeTodaysEmail, waitForTomorrow } from "../outbound/emailLimit";
import { linkWithToken } from "./inviteLink";
import { joiningRefusals } from "./joining";
import { approvedEmail } from "./joiningEmails";
import { callerEmail, getLeague, refuse, runnerOf, signedInEmail, teamOf, teamsOf } from "../shared/leagueAccess";
import { recordEvent } from "../mail/letters";
import { delivery } from "../schema";
import { putOnTeam } from "../leagues/teams";
import { leagueOpens } from "../leagues/leagueOpens";
import { LEAGUES_READ_MOST, takeAllOrThrow } from "../shared/cappedRead";

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

/** The league the invite link's page names, with who runs it and how full it is, as its approved
 *  picture shows (#1497). The commissioner's email goes only to a signed-in caller: the page is
 *  drawn signed in, and a link passed around reaches people who never sign in. */
const joinPageLeague = { leagueName: v.string(), commissionerEmail: v.union(v.string(), v.null()), teams: v.number(), maxTeams: v.number() };

/** What the invite link's page shows: the league, and whether the person may ask, has asked and
 *  waits, or runs a team in the league already; null once the link no longer works, or while the
 *  league is being deleted (spec/13 hides it then). */
const joinPageData = v.union(
  v.null(),
  v.object({ ...joinPageLeague, standing: v.union(v.literal("mayAsk"), v.literal("waiting")) }),
  v.object({ ...joinPageLeague, standing: v.literal("inLeague"), teamName: v.string() }),
);
export type JoinPageData = Infer<typeof joinPageData>;

/** Open to anyone holding the link, signed in or not: null for a link that no longer works or a
 *  league being deleted. */
export const joinPage = query({
  args: { token: v.string() },
  returns: joinPageData,
  handler: async (ctx, { token }) => {
    const link = await linkWithToken(ctx, token);
    const league = link && (await ctx.db.get("leagues", link.leagueId));
    if (!league || !leagueOpens(league)) return null;
    const teams = await teamsOf(ctx, league._id);
    const shown = { leagueName: league.name, commissionerEmail: league.commissionerEmail, teams: teams.length, maxTeams: league.maxTeams };
    const email = await signedInEmail(ctx);
    if (email === null) return { ...shown, commissionerEmail: null, standing: "mayAsk" as const };
    const team = teams.find((each) => each.managerEmail === email);
    if (team) return { ...shown, standing: "inLeague" as const, teamName: team.name };
    const waiting = await waitingRequestOf(ctx, league._id, email);
    return { ...shown, standing: waiting ? ("waiting" as const) : ("mayAsk" as const) };
  },
});

/** The leagues the signed-in person has asked to join and waits on, by name, for "Your leagues"
 *  (spec/13: they see it waits for the commissioner). A league being deleted is hidden from them. */
export const waitingMine = query({
  args: {},
  returns: v.array(v.object({ leagueName: v.string() })),
  handler: async (ctx) => {
    const email = await signedInEmail(ctx);
    if (email === null) return [];
    const requests = await takeAllOrThrow(
      ctx.db.query("joinRequests").withIndex("by_email_and_decision", (q) => q.eq("email", email).eq("decision", undefined)),
      LEAGUES_READ_MOST,
      `${email} waits on more join requests than there can be leagues`,
    );
    const leagues = await Promise.all(requests.map((request) => ctx.db.get("leagues", request.leagueId)));
    return leagues.flatMap((league) => (league && leagueOpens(league) ? [{ leagueName: league.name }] : []));
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
    let sendError: string | null = null;
    try {
      await sendEmail(to.email, approvedEmail({ leagueName: to.leagueName, teamName: args.teamName }, Date.now()));
    } catch (error) {
      sendError = logFailure(`The email telling ${to.email} they're in ${to.leagueName} wasn't sent`, error);
    }
    // outside the try: a failure to save the outcome fails the action, never reads as "not sent"
    await ctx.runMutation(
      internal.joining.joinRequests.recordApprovedEmail,
      sendError === null ? { requestId: args.requestId, delivery: "sent" } : { requestId: args.requestId, delivery: "notSent", sendError },
    );
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
    await waitForTomorrow(ctx.scheduler, internal.joining.joinRequests.sendApprovedEmail, args);
    return null;
  },
});

/** Where the approved person's email stands, with what the email service said when it refused it. */
export const recordApprovedEmail = internalMutation({
  args: { requestId: v.id("joinRequests"), delivery, sendError: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { requestId, delivery, sendError }) => {
    await ctx.db.patch("joinRequests", requestId, { approvedEmail: delivery, approvedEmailError: sendError });
    return null;
  },
});
