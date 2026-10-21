import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { internalMutation, mutation, type QueryCtx } from "./_generated/server";
import { callerEmail, deleterOf, isAdmin, recordEvent, refuse, refusals, teamsOf } from "./leagueAccess";
import { DELETION_UNDO_HOURS } from "./leagueLimits";

// Deleting a league (#75, spec/13, Deleting). For DELETION_UNDO_HOURS it can be undone: it is
// frozen (leagueAccess's getLeague refuses every change to it), hidden from everyone with a part
// in it but whoever deleted it (myLeagues.ts), and each of them is emailed (deletionNotices.ts).
// Then deleteForGood removes it and every row keyed to it: nothing is archived.

/** How long after it is deleted a league is gone for good. */
export const UNDO_MS = DELETION_UNDO_HOURS * 60 * 60 * 1000;
/** The most rows of one table one run of deleteForGood deletes, so a long season's events never
 *  outgrow a mutation: a full batch hands on to another run. */
const ROWS_PER_RUN = 500;

type LeagueRowsBatch<Table extends TableNames> = (ctx: QueryCtx, leagueId: Id<"leagues">) => Promise<Doc<Table>[]>;

/** Each table with rows keyed to a league, and a batch of the league's rows in it. A table that
 *  gains a `leagueId` belongs here: leagueDeletion.test.ts fails until it is. */
const leagueRows: { [Table in TableNames]?: LeagueRowsBatch<Table> } = {
  teams: (ctx, leagueId) =>
    ctx.db
      .query("teams")
      .withIndex("by_leagueId_and_number", (q) => q.eq("leagueId", leagueId))
      .take(ROWS_PER_RUN),
  leagueEvents: (ctx, leagueId) =>
    ctx.db
      .query("leagueEvents")
      .withIndex("by_leagueId_and_at", (q) => q.eq("leagueId", leagueId))
      .take(ROWS_PER_RUN),
  invites: (ctx, leagueId) =>
    ctx.db
      .query("invites")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
      .take(ROWS_PER_RUN),
  inviteLinks: (ctx, leagueId) =>
    ctx.db
      .query("inviteLinks")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
      .take(ROWS_PER_RUN),
  joinRequests: (ctx, leagueId) =>
    ctx.db
      .query("joinRequests")
      .withIndex("by_leagueId_and_decision", (q) => q.eq("leagueId", leagueId))
      .take(ROWS_PER_RUN),
  leagueRules: (ctx, leagueId) =>
    ctx.db
      .query("leagueRules")
      .withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId))
      .take(ROWS_PER_RUN),
  lastLeagues: (ctx, leagueId) =>
    ctx.db
      .query("lastLeagues")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
      .take(ROWS_PER_RUN),
};

export const tablesKeyedToLeague = Object.keys(leagueRows);

/** Everyone with a part in the league but `by`: whom deleting it hides it from, and who is told. */
async function othersIn(ctx: QueryCtx, league: Doc<"leagues">, by: string): Promise<string[]> {
  const managers = (await teamsOf(ctx, league._id)).map((team) => team.managerEmail);
  const people = new Set([league.commissionerEmail, league.coCommissionerEmail, ...managers]);
  return [...people].filter((email): email is string => email !== undefined && email !== by);
}

/** The admin or the league's commissioner deletes it, to be gone for good in UNDO_MS. */
export const deleteLeague = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const { email: by, league } = await deleterOf(ctx, leagueId);
    const deletesAt = Date.now() + UNDO_MS;
    const scheduledId = await ctx.scheduler.runAt(deletesAt, internal.leagueDeletion.deleteForGood, { leagueId });
    await ctx.db.patch("leagues", leagueId, { deletion: { by, deletesAt, scheduledId, unemailed: [] } });
    await recordEvent(ctx, leagueId, by, { kind: "deletionStarted", name: league.name, deletesAt });
    await ctx.scheduler.runAfter(0, internal.deletionNotices.send, {
      leagueId,
      leagueName: league.name,
      by,
      deletesAt,
      emails: await othersIn(ctx, league, by),
    });
    return null;
  },
});

/** Whoever deleted the league, or the admin, undoes it before it is gone, and it is as it was. */
export const undo = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const email = await callerEmail(ctx);
    const league = (await ctx.db.get("leagues", leagueId)) ?? refuse(refusals.noLeague);
    const { deletion } = league;
    if (!deletion) refuse(refusals.notBeingDeleted);
    if (email !== deletion.by && !isAdmin(email)) refuse(refusals.notUndoer);
    if (Date.now() >= deletion.deletesAt) refuse(refusals.tooLateToUndo);
    await ctx.scheduler.cancel(deletion.scheduledId);
    await ctx.db.patch("leagues", leagueId, { deletion: undefined });
    await recordEvent(ctx, leagueId, email, { kind: "deletionUndone", name: league.name });
    return null;
  },
});

/** Deletes the league for good: every row keyed to it, a batch of each table a run, then the
 *  league itself last, so it stays frozen and hidden until nothing of it is left. */
export const deleteForGood = internalMutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const league = await ctx.db.get("leagues", leagueId);
    if (!league?.deletion) throw new Error(`League ${leagueId} isn't being deleted, so it wasn't deleted for good`);
    let more = false;
    for (const batchOf of Object.values(leagueRows)) {
      const rows = await batchOf(ctx, leagueId);
      for (const row of rows) await ctx.db.delete(row._id);
      more ||= rows.length === ROWS_PER_RUN;
    }
    if (more) await ctx.scheduler.runAfter(0, internal.leagueDeletion.deleteForGood, { leagueId });
    else await ctx.db.delete("leagues", leagueId);
    return null;
  },
});
