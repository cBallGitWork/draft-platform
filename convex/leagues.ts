import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { adminEmail, admitEmail } from "./allowedEmails";
import {
  callerEmail,
  namedEmail,
  namerOf,
  recordEvent,
  refuse,
  refusals,
  runnerOf,
  teamsOf,
} from "./leagueAccess";
import { FEWEST_TEAMS, MOST_TEAMS } from "./leagueLimits";
import { askForLink, signInReply } from "./signInLinks";

// A league, and who runs it (#24, spec/13). Each change files an event for Mail (#26).

function checkMaxTeams(maxTeams: number): void {
  if (!Number.isInteger(maxTeams) || maxTeams < FEWEST_TEAMS || maxTeams > MOST_TEAMS) refuse(refusals.maxOutOfRange);
}

/** Lets a newly named person sign in: puts them on the allowed list and, for a commissioner with
 *  no account yet, sends them a sign-in link (spec/13, Creating a league). */
async function admitNamed(ctx: MutationCtx, email: string, leagueId: Id<"leagues">, sendLink: boolean): Promise<void> {
  await admitEmail(ctx, email);
  if (!sendLink) return;
  const account = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .first();
  if (account === null) await ctx.scheduler.runAfter(0, internal.leagues.sendCommissionerLink, { leagueId, email });
}

export const create = mutation({
  args: { name: v.string(), maxTeams: v.number(), commissionerEmail: v.string() },
  returns: v.id("leagues"),
  handler: async (ctx, args) => {
    const by = await callerEmail(ctx);
    if (by !== adminEmail()) refuse(refusals.notAdmin);
    const name = args.name.trim();
    if (!name) refuse(refusals.blankName);
    checkMaxTeams(args.maxTeams);
    const commissionerEmail = namedEmail(args.commissionerEmail);

    const leagueId = await ctx.db.insert("leagues", { name, maxTeams: args.maxTeams, commissionerEmail });
    await recordEvent(ctx, leagueId, by, { kind: "created", name, maxTeams: args.maxTeams });
    await recordEvent(ctx, leagueId, by, { kind: "commissionerNamed", email: commissionerEmail });
    await admitNamed(ctx, commissionerEmail, leagueId, true);
    return leagueId;
  },
});

/** spec/13: the commissioner raises or lowers the maximum, never below the teams already there. */
export const setMaxTeams = mutation({
  args: { leagueId: v.id("leagues"), maxTeams: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, maxTeams }) => {
    const { email, league } = await runnerOf(ctx, leagueId);
    checkMaxTeams(maxTeams);
    const teams = (await teamsOf(ctx, leagueId)).length;
    if (maxTeams < teams) refuse(refusals.belowTeams(teams));
    if (maxTeams === league.maxTeams) return null;
    await ctx.db.patch("leagues", leagueId, { maxTeams });
    await recordEvent(ctx, leagueId, email, { kind: "maxTeamsChanged", from: league.maxTeams, to: maxTeams });
    return null;
  },
});

/** Hands the league to a new commissioner. Only the commissioner or the admin may. */
export const nameCommissioner = mutation({
  args: { leagueId: v.id("leagues"), email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { email: by, league } = await namerOf(ctx, args.leagueId);
    const email = namedEmail(args.email);
    if (email === league.commissionerEmail) refuse(refusals.alreadyCommissioner(email));
    if (email === league.coCommissionerEmail) refuse(refusals.isCoCommissioner(email));
    await ctx.db.patch("leagues", league._id, { commissionerEmail: email });
    await recordEvent(ctx, league._id, by, { kind: "commissionerNamed", email });
    await admitNamed(ctx, email, league._id, true);
    return null;
  },
});

/** Names the league's one co-commissioner, replacing any, or with `email` null removes them. Only
 *  the commissioner or the admin may. */
export const nameCoCommissioner = mutation({
  args: { leagueId: v.id("leagues"), email: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { email: by, league } = await namerOf(ctx, args.leagueId);
    const email = args.email === null ? null : namedEmail(args.email);
    if (email === league.commissionerEmail) refuse(refusals.alreadyCommissioner(email));
    if (email === (league.coCommissionerEmail ?? null)) return null;
    await ctx.db.patch("leagues", league._id, { coCommissionerEmail: email ?? undefined });
    await recordEvent(ctx, league._id, by, { kind: "coCommissionerNamed", email });
    if (email !== null) await admitNamed(ctx, email, league._id, false);
    return null;
  },
});

/** Sends a newly named commissioner their sign-in link the way the sign-in page asks for one,
 *  and keeps the answer on the league, so the admin sees a link that didn't go. */
export const sendCommissionerLink = internalAction({
  args: { leagueId: v.id("leagues"), email: v.string() },
  returns: v.null(),
  handler: async (ctx, { leagueId, email }) => {
    const reply = await askForLink(ctx, email);
    await ctx.runMutation(internal.leagues.recordCommissionerLink, { leagueId, email, reply });
    return null;
  },
});

export const recordCommissionerLink = internalMutation({
  args: { leagueId: v.id("leagues"), email: v.string(), reply: signInReply },
  returns: v.null(),
  handler: async (ctx, { leagueId, email, reply }) => {
    await ctx.db.patch("leagues", leagueId, { commissionerLink: { email, reply } });
    return null;
  },
});
