import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { admitEmail } from "./allowedEmails";
import { invitedPath } from "./joinLinks";
import { INVITE_LIFETIME_MS, deliveryOf, joiningRefusals, startOfNextDay } from "./joining";
import { inviteEmail } from "./joiningEmails";
import { namedEmail, recordEvent, refuse, refusals, runnerOf, teamsOf } from "./leagueAccess";
import { askForLink, signInReply } from "./signInLinks";
import { putOnTeam } from "./teams";

// Emailed invites (#73, spec/13 Joining): an invite names a vacated team or a new one, carries a
// sign-in link, and the person joins on signing in, with no approval, while it lasts (7 days).
// Each change the league's runners make files an event for Mail (#26).

/** The most unexpired invites to one email read at once: far more leagues than invite anyone in a week. */
const UNEXPIRED_INVITES_READ = 100;

/** Whether the invite was cancelled, or the person signed in and it was taken up or couldn't be. */
const hasEnded = (invite: Doc<"invites">) =>
  invite.cancelledAt !== undefined || invite.joined !== undefined || invite.couldNotJoin !== undefined;

/** The invites to this email that can still be taken up at `now`. */
async function liveInvitesTo(ctx: QueryCtx, email: string, now: number) {
  const unexpired = await ctx.db
    .query("invites")
    .withIndex("by_email_and_expiresAt", (q) => q.eq("email", email).gt("expiresAt", now))
    .take(UNEXPIRED_INVITES_READ);
  return unexpired.filter((invite) => !hasEnded(invite));
}

/** The invite, if the caller may run its league, with the league and what an event says of it. */
async function inviteToRun(ctx: QueryCtx, inviteId: Id<"invites">) {
  const invite = (await ctx.db.get("invites", inviteId)) ?? refuse(joiningRefusals.noInvite);
  const { email: by } = await runnerOf(ctx, invite.leagueId);
  if (hasEnded(invite)) refuse(joiningRefusals.inviteEnded);
  const team = invite.teamId === undefined ? null : await ctx.db.get("teams", invite.teamId);
  const invitedTo = { email: invite.email, teamId: invite.teamId ?? null, teamName: team?.name ?? null };
  return { by, invite, invitedTo };
}

export const send = mutation({
  args: { leagueId: v.id("leagues"), email: v.string(), teamId: v.optional(v.id("teams")) },
  returns: v.id("invites"),
  handler: async (ctx, args) => {
    const { email: by, league } = await runnerOf(ctx, args.leagueId);
    const email = namedEmail(args.email);
    const teams = await teamsOf(ctx, league._id);
    if (teams.some((team) => team.managerEmail === email)) refuse(refusals.alreadyManager(email));
    let teamName: string | null = null;
    if (args.teamId !== undefined) {
      const team = teams.find((each) => each._id === args.teamId) ?? refuse(refusals.noTeam);
      if (team.managerEmail !== undefined) refuse(refusals.notVacated);
      teamName = team.name;
    } else if (teams.length >= league.maxTeams) {
      refuse(refusals.full(league.maxTeams));
    }
    const now = Date.now();
    if ((await liveInvitesTo(ctx, email, now)).some((invite) => invite.leagueId === league._id)) {
      refuse(joiningRefusals.alreadyInvited(email));
    }

    await admitEmail(ctx, email);
    const inviteId = await ctx.db.insert("invites", {
      leagueId: league._id,
      email,
      teamId: args.teamId,
      invitedBy: by,
      expiresAt: now + INVITE_LIFETIME_MS,
      delivery: "sending",
    });
    await recordEvent(ctx, league._id, by, { kind: "invited", email, teamId: args.teamId ?? null, teamName });
    await ctx.scheduler.runAfter(0, internal.invites.deliver, { inviteId });
    return inviteId;
  },
});

/** Sends the invite again, for 7 more days from when it goes. */
export const resend = mutation({
  args: { inviteId: v.id("invites") },
  returns: v.null(),
  handler: async (ctx, { inviteId }) => {
    const { by, invite, invitedTo } = await inviteToRun(ctx, inviteId);
    if (invite.delivery === "waiting") refuse(joiningRefusals.inviteWaiting);
    await ctx.db.patch("invites", inviteId, { delivery: "sending" });
    await recordEvent(ctx, invite.leagueId, by, { kind: "inviteResent", ...invitedTo });
    await ctx.scheduler.runAfter(0, internal.invites.deliver, { inviteId });
    return null;
  },
});

export const cancel = mutation({
  args: { inviteId: v.id("invites") },
  returns: v.null(),
  handler: async (ctx, { inviteId }) => {
    const { by, invite, invitedTo } = await inviteToRun(ctx, inviteId);
    await ctx.db.patch("invites", inviteId, { cancelledAt: Date.now() });
    await recordEvent(ctx, invite.leagueId, by, { kind: "inviteCancelled", ...invitedTo });
    return null;
  },
});

/** Sends the invite's email, a sign-in link that leads to it, as the sign-in page asks for one. */
export const deliver = internalAction({
  args: { inviteId: v.id("invites") },
  returns: v.null(),
  handler: async (ctx, { inviteId }) => {
    const email: string | null = await ctx.runQuery(internal.invites.emailToDeliver, { inviteId });
    if (email === null) return null;
    const reply = await askForLink(ctx, email, invitedPath(inviteId));
    await ctx.runMutation(internal.invites.recordDelivery, { inviteId, reply });
    return null;
  },
});

/** Whom the invite goes to, or null once it was cancelled or the person signed in. */
export const emailToDeliver = internalQuery({
  args: { inviteId: v.id("invites") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { inviteId }) => {
    const invite = await ctx.db.get("invites", inviteId);
    if (!invite) throw new Error(`Invite ${inviteId} doesn't exist, so it can't be sent`);
    return hasEnded(invite) ? null : invite.email;
  },
});

/** Keeps how the email went. Sent, the invite lasts 7 days from now; past the day's emails, it
 *  waits for tomorrow and goes by itself then (spec/13). */
export const recordDelivery = internalMutation({
  args: { inviteId: v.id("invites"), reply: signInReply },
  returns: v.null(),
  handler: async (ctx, { inviteId, reply }) => {
    const now = Date.now();
    const delivery = deliveryOf(reply);
    await ctx.db.patch("invites", inviteId, delivery === "sent" ? { delivery, expiresAt: now + INVITE_LIFETIME_MS } : { delivery });
    if (delivery === "waiting") await ctx.scheduler.runAt(startOfNextDay(now), internal.invites.deliver, { inviteId });
    return null;
  },
});

/** The invite's email, carrying its sign-in link `url` (signInEmail.ts). */
export const email = internalQuery({
  args: { inviteId: v.string(), url: v.string() },
  returns: v.object({ subject: v.string(), text: v.string() }),
  handler: async (ctx, { inviteId, url }) => {
    const id = ctx.db.normalizeId("invites", inviteId);
    const invite = id && (await ctx.db.get("invites", id));
    if (!invite) throw new Error(`Invite ${inviteId} doesn't exist, so its email can't say what it's for`);
    const league = await ctx.db.get("leagues", invite.leagueId);
    if (!league) throw new Error(`Invite ${inviteId} is to league ${invite.leagueId}, which doesn't exist`);
    const team = invite.teamId === undefined ? null : await ctx.db.get("teams", invite.teamId);
    return inviteEmail(url, { leagueName: league.name, invitedBy: invite.invitedBy, teamName: team?.name ?? null });
  },
});

/** Takes up every live invite to this email: run when they sign in (auth.ts). One that can't be
 *  taken up (the team was handed on, the league filled) says why, for the commissioner to see. */
export async function joinByInvites(ctx: MutationCtx, email: string): Promise<void> {
  for (const invite of await liveInvitesTo(ctx, email, Date.now())) {
    let joined;
    try {
      const league = (await ctx.db.get("leagues", invite.leagueId)) ?? refuse(refusals.noLeague);
      joined = await putOnTeam(ctx, league, email, invite.teamId);
    } catch (error) {
      if (!(error instanceof ConvexError)) throw error;
      await ctx.db.patch("invites", invite._id, { couldNotJoin: String(error.data) });
      continue;
    }
    await ctx.db.patch("invites", invite._id, { joined });
    await recordEvent(ctx, invite.leagueId, email, { kind: "joinedByInvite", email, ...joined, invitedBy: invite.invitedBy });
  }
}
