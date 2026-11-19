import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { LEAGUES_READ_MOST, takeAllOrThrow, takeShown } from "../shared/cappedRead";
import { adminOf, getLeague, managerOf, refuse, teamOf } from "../shared/leagueAccess";
import { MOST_TEAMS } from "./leagueLimits";
import { handOver } from "./leagues";

// Asking to be commissioner (spec/01 S01.3): in a league with no commissioner, any manager may ask
// at any time, mid-draft included, from the commissioner's letters (S01.2). The admin approves or
// refuses; approved, the manager is the commissioner at once. Modelled on the join requests
// (../joining/joinRequests.ts). A manager has at most one ask waiting in a league.

/** Why an ask was refused, as the person who asked is told it. */
export const commissionerAskRefusals = {
  hasCommissioner: "This league already has a commissioner.",
  noAsk: "There's no such ask to be commissioner.",
  decided: "That ask has already been approved or refused.",
  leftLeague: "They no longer run a team in this league.",
} as const;

/** The manager's ask waiting in this league, if any. */
function waitingAskOf(ctx: QueryCtx, leagueId: Id<"leagues">, email: string) {
  return ctx.db
    .query("commissionerAsks")
    .withIndex("by_leagueId_and_email_and_decision", (q) => q.eq("leagueId", leagueId).eq("email", email).eq("decision", undefined))
    .first();
}

/** Where `email` stands on asking to be the league's commissioner: null when they can't, as the
 *  league has one or they manage no team in it; otherwise whether their ask waits (Mail's button). */
export async function askStanding(ctx: QueryCtx, league: Doc<"leagues">, email: string): Promise<{ asked: boolean } | null> {
  if (league.commissionerEmail !== undefined || !(await teamOf(ctx, league._id, email))) return null;
  return { asked: (await waitingAskOf(ctx, league._id, email)) !== null };
}

/** Asks to be the league's commissioner. Asking again while one waits changes nothing. */
export const ask = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const { email, league } = await managerOf(ctx, leagueId);
    if (league.commissionerEmail !== undefined) refuse(commissionerAskRefusals.hasCommissioner);
    if (await waitingAskOf(ctx, leagueId, email)) return null;
    await ctx.db.insert("commissionerAsks", { leagueId, email });
    return null;
  },
});

const waitingAsk = v.object({ askId: v.id("commissionerAsks"), leagueName: v.string(), email: v.string() });
export type WaitingAsk = Infer<typeof waitingAsk>;

/** The asks waiting for the admin, oldest first, and whether more wait than are shown. */
export const waiting = query({
  args: {},
  returns: v.object({ asks: v.array(waitingAsk), more: v.boolean() }),
  handler: async (ctx) => {
    await adminOf(ctx);
    const { rows, more } = await takeShown(
      ctx.db.query("commissionerAsks").withIndex("by_decision", (q) => q.eq("decision", undefined)),
      LEAGUES_READ_MOST,
    );
    const asks = await Promise.all(
      rows.map(async (row) => {
        const league = await ctx.db.get("leagues", row.leagueId);
        return league && { askId: row._id, leagueName: league.name, email: row.email };
      }),
    );
    return { asks: asks.filter((each) => each !== null), more };
  },
});

/** The ask and its league, if it waits, the league isn't being deleted and the caller is the admin. */
async function waitingAskToDecide(ctx: QueryCtx, askId: Id<"commissionerAsks">) {
  const by = await adminOf(ctx);
  const ask = (await ctx.db.get("commissionerAsks", askId)) ?? refuse(commissionerAskRefusals.noAsk);
  const league = await getLeague(ctx, ask.leagueId);
  if (ask.decision !== undefined) refuse(commissionerAskRefusals.decided);
  return { by, ask, league };
}

/** The other asks waiting in the league, refused once one is approved: the league has its commissioner. */
async function refuseTheRest(ctx: MutationCtx, leagueId: Id<"leagues">) {
  const rest = await takeAllOrThrow(
    ctx.db.query("commissionerAsks").withIndex("by_leagueId_and_decision", (q) => q.eq("leagueId", leagueId).eq("decision", undefined)),
    MOST_TEAMS,
    `League ${leagueId} has more asks to be commissioner waiting than it can have managers`,
  );
  for (const each of rest) await ctx.db.patch("commissionerAsks", each._id, { decision: "refused" });
}

/** Approves the ask: the manager is the league's commissioner at once, with every power (S01.3). */
export const approve = mutation({
  args: { askId: v.id("commissionerAsks") },
  returns: v.null(),
  handler: async (ctx, { askId }) => {
    const { by, ask, league } = await waitingAskToDecide(ctx, askId);
    if (league.commissionerEmail !== undefined) refuse(commissionerAskRefusals.hasCommissioner);
    if (!(await teamOf(ctx, league._id, ask.email))) refuse(commissionerAskRefusals.leftLeague);
    await ctx.db.patch("commissionerAsks", askId, { decision: "approved" });
    await refuseTheRest(ctx, league._id);
    await handOver(ctx, league, by, { kind: "commissionerNamed", email: ask.email, replaced: null });
    return null;
  },
});

/** Refuses the ask. The manager may ask again. */
export const refuseAsk = mutation({
  args: { askId: v.id("commissionerAsks") },
  returns: v.null(),
  handler: async (ctx, { askId }) => {
    await waitingAskToDecide(ctx, askId);
    await ctx.db.patch("commissionerAsks", askId, { decision: "refused" });
    return null;
  },
});
