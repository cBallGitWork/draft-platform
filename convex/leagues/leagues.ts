import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalMutation, mutation, type MutationCtx } from "../_generated/server";
import { admitEmail } from "../signIn/allowedEmails";
import {
  adminOf,
  namedEmail,
  namerOf,
  recordEvent,
  refuse,
  refusals,
  runnerOf,
  teamsOf,
} from "../shared/leagueAccess";
import { FEWEST_TEAMS, MOST_TEAMS } from "./leagueLimits";
import { giveDefaultRules } from "../rules/leagueRules";
import { askForLink, hasOpenedALink, signInReply } from "../signIn/signInLinks";

// A league, and who runs it (#24, spec/13). Each change files an event for Mail (#26).

function checkMaxTeams(maxTeams: number): void {
  if (!Number.isInteger(maxTeams) || maxTeams < FEWEST_TEAMS || maxTeams > MOST_TEAMS) refuse(refusals.maxOutOfRange);
}

/** Lets a newly named commissioner sign in, and sends them a sign-in link unless they have opened
 *  one before (spec/13, Creating a league). */
async function admitCommissioner(ctx: MutationCtx, email: string, leagueId: Id<"leagues">): Promise<void> {
  await admitEmail(ctx, email);
  if (!(await hasOpenedALink(ctx, email))) {
    await ctx.scheduler.runAfter(0, internal.leagues.leagues.sendCommissionerLink, { leagueId, email });
  }
}

export const create = mutation({
  args: { name: v.string(), maxTeams: v.number(), commissionerEmail: v.string() },
  returns: v.id("leagues"),
  handler: async (ctx, args) => {
    const by = await adminOf(ctx);
    const name = args.name.trim();
    if (!name) refuse(refusals.blankName);
    checkMaxTeams(args.maxTeams);
    const commissionerEmail = namedEmail(args.commissionerEmail);

    const leagueId = await ctx.db.insert("leagues", { name, maxTeams: args.maxTeams, commissionerEmail });
    await recordEvent(ctx, leagueId, by, { kind: "created", name, maxTeams: args.maxTeams });
    await recordEvent(ctx, leagueId, by, { kind: "commissionerNamed", email: commissionerEmail, replaced: null });
    await giveDefaultRules(ctx, leagueId);
    await admitCommissioner(ctx, commissionerEmail, leagueId);
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
    const teamCount = (await teamsOf(ctx, leagueId)).length;
    if (maxTeams < teamCount) refuse(refusals.belowTeams(teamCount));
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
    if (email === league.coCommissionerEmail) refuse(refusals.alreadyCoCommissioner(email));
    // The last commissioner's link, if it didn't go, is theirs: no longer the admin's concern.
    await ctx.db.patch("leagues", league._id, { commissionerEmail: email, commissionerLink: undefined });
    await recordEvent(ctx, league._id, by, { kind: "commissionerNamed", email, replaced: league.commissionerEmail });
    await admitCommissioner(ctx, email, league._id);
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
    const replaced = league.coCommissionerEmail ?? null;
    if (email === replaced) return null;
    await ctx.db.patch("leagues", league._id, { coCommissionerEmail: email ?? undefined });
    if (email !== null) {
      await recordEvent(ctx, league._id, by, { kind: "coCommissionerNamed", email, replaced });
      await admitEmail(ctx, email);
    } else if (replaced !== null) {
      await recordEvent(ctx, league._id, by, { kind: "coCommissionerRemoved", email: replaced });
    }
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
    await ctx.runMutation(internal.leagues.leagues.recordCommissionerLink, { leagueId, email, reply });
    return null;
  },
});

export const recordCommissionerLink = internalMutation({
  args: { leagueId: v.id("leagues"), email: v.string(), reply: signInReply },
  returns: v.null(),
  handler: async (ctx, { leagueId, email, reply }) => {
    const league = await ctx.db.get("leagues", leagueId);
    if (!league) throw new Error(`League ${leagueId} doesn't exist, so ${email}'s sign-in link can't be kept on it`);
    // An answer that comes back after another commissioner was named is no longer the league's.
    if (league.commissionerEmail !== email) return null;
    await ctx.db.patch("leagues", leagueId, { commissionerLink: { email, reply } });
    return null;
  },
});
