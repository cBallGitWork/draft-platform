import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import { internalMutation, mutation, type QueryCtx } from "../_generated/server";
import { callerEmail, deleterOf, refuse, refusals, seesWhileDeleted } from "../shared/leagueAccess";
import { DELETION_UNDO_HOURS } from "./leagueLimits";
import { recordEvent, wholeLeague } from "../mail/letters";
import { HOUR_MS } from "../shared/time";

// Deleting a league (#75, spec/13, Deleting). For DELETION_UNDO_HOURS it can be undone: it is
// frozen (leagueAccess's getLeague refuses every change to it), hidden from everyone with a part
// in it but its commissioner (myLeagues.ts), and everyone with a part in it but whoever deleted it
// is emailed (deletionNotices.ts).
// Then deleteForGood removes it and every row keyed to it: nothing is archived.

/** How long after it is deleted a league is gone for good. */
export const UNDO_MS = DELETION_UNDO_HOURS * HOUR_MS;
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
  squadPlayers: (ctx, leagueId) =>
    ctx.db
      .query("squadPlayers")
      .withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId))
      .take(ROWS_PER_RUN),
  letters: (ctx, leagueId) =>
    ctx.db
      .query("letters")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
      .take(ROWS_PER_RUN),
};

export const tablesKeyedToLeague = Object.keys(leagueRows);

/** Everyone with a part in the league but `by`: who is told it is being deleted. */
async function othersIn(ctx: QueryCtx, league: Doc<"leagues">, by: string): Promise<string[]> {
  return [...new Set(await wholeLeague(ctx, league))].filter((email) => email !== by);
}

/** The admin or the league's commissioner deletes it, to be gone for good in UNDO_MS. */
export const deleteLeague = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const { email: by, league } = await deleterOf(ctx, leagueId);
    const deletesAt = Date.now() + UNDO_MS;
    const scheduledId = await ctx.scheduler.runAt(deletesAt, internal.leagues.leagueDeletion.deleteForGood, { leagueId });
    await ctx.db.patch("leagues", leagueId, { deletion: { by, deletesAt, scheduledId, unemailed: [] } });
    await recordEvent(ctx, leagueId, by, { kind: "deletionStarted", name: league.name, deletesAt });
    await ctx.scheduler.runAfter(0, internal.leagues.deletionNotices.send, {
      leagueId,
      leagueName: league.name,
      by,
      deletesAt,
      emails: await othersIn(ctx, league, by),
    });
    return null;
  },
});

/** The league's commissioner or the admin, whichever deleted it, undoes it before it is gone, and
 *  it is as it was. */
export const undo = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const email = await callerEmail(ctx);
    const league = (await ctx.db.get("leagues", leagueId)) ?? refuse(refusals.noLeague);
    const { deletion } = league;
    if (!deletion) refuse(refusals.notBeingDeleted);
    if (!seesWhileDeleted(league, email)) refuse(refusals.notUndoer);
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
    if (more) await ctx.scheduler.runAfter(0, internal.leagues.leagueDeletion.deleteForGood, { leagueId });
    else await ctx.db.delete("leagues", leagueId);
    return null;
  },
});
