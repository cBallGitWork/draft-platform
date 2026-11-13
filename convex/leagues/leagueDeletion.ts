import type { Indexes, NamedTableInfo } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { DataModel, Doc, Id, TableNames } from "../_generated/dataModel";
import { internalMutation, mutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { callerEmail, deleterOf, refuse, refusals, seesWhileDeleted } from "../shared/leagueAccess";
import { DELETION_UNDO_HOURS } from "./leagueLimits";
import { recordEvent, wholeLeague } from "../mail/letters";
import { HOUR_MS } from "../shared/time";
import { pauseForDeletion } from "../draft/draftPause";
import { pauseReviews, resumeReviews } from "../trades/reviewPause";

// Deleting a league (#75, spec/13, Deleting). For DELETION_UNDO_HOURS it can be undone: it is
// frozen (leagueAccess's getLeague refuses every change to it), hidden from everyone with a part
// in it but its commissioner (myLeagues.ts), and nobody is emailed. Its Mail letters, that it is
// being deleted and that it no longer is, go only to its commissioner and whoever deleted or undid
// it, as "an undone deletion tells no one" (spec/13; Claude's call on #897, Craig's "your call").
// A live draft pauses as it is deleted, and an undo leaves it paused for its commissioner to resume
// (draft/draftPause.ts; Craig, 11 Nov 2026, on #1486). A trade in review stops its clock too, and an
// undo gives it back the time it had left (trades/reviewPause.ts; Craig, 11 Nov 2026, on #1493). Then deleteForGood removes it and every row keyed to it: nothing is archived. Only once it is
// gone is everyone with a part in it but whoever deleted it emailed (deletionNotices.ts, #320).

/** How long after it is deleted a league is gone for good. */
export const UNDO_MS = DELETION_UNDO_HOURS * HOUR_MS;
/** The most rows of one table one run of deleteForGood deletes, so a long season's events never
 *  outgrow a mutation: a full batch hands on to another run. */
const ROWS_PER_RUN = 500;

/** A table's index names, as its schema defines them. */
type IndexOf<Table extends TableNames> = keyof Indexes<NamedTableInfo<DataModel, Table>>;

/** Each table with rows keyed to a league, and its index that starts with `leagueId`. A table that
 *  gains a `leagueId` belongs here: leagueDeletion.test.ts fails until it is. */
const leagueIndexes: { [Table in TableNames]?: IndexOf<Table> } = {
  teams: "by_leagueId_and_number",
  leagueEvents: "by_leagueId_and_at",
  invites: "by_leagueId",
  inviteLinks: "by_leagueId",
  joinRequests: "by_leagueId_and_decision",
  leagueRules: "by_leagueId_and_fromGameweek",
  passedDeadlines: "by_leagueId_and_gameweek",
  keptDeadlines: "by_leagueId_and_gameweek",
  playedFixtures: "by_leagueId_and_gameweek",
  fixtureEdits: "by_leagueId_and_gameweek",
  finalScores: "by_leagueId_and_gameweek",
  pointsOverrides: "by_leagueId_and_playerCode",
  teamOverrides: "by_leagueId_and_gameweek_and_teamId",
  lastLeagues: "by_leagueId",
  squadPlayers: "by_leagueId_and_playerCode",
  waiverPlayers: "by_leagueId_and_playerCode",
  waiverClaims: "by_leagueId_and_teamId_and_rank",
  waiverOrders: "by_leagueId",
  waiverStarts: "by_leagueId",
  // A trade in review's timer finds no offer once it is gone, and does nothing.
  tradeOffers: "by_leagueId",
  closedTradeOffers: "by_leagueId",
  recaps: "by_leagueId_and_gameweek",
  scouts: "by_leagueId",
  shortlistPlayers: "by_leagueId_and_playerCode",
  lineups: "by_leagueId_and_teamId_and_fromGameweek",
  savedPlans: "by_leagueId_and_teamId_and_name",
  deadlineStars: "by_leagueId_and_gameweek_and_teamId",
  teamGameweekStats: "by_leagueId_and_gameweek_and_teamId",
  teamSeasonStats: "by_leagueId_and_teamId",
  letters: "by_leagueId",
  // Its scheduled start, if any, finds no row and does nothing (draft/draftStart.ts).
  drafts: "by_leagueId",
  draftLists: "by_leagueId",
  draftPicks: "by_leagueId_and_pick",
};

/** A table's query as leagueBatch uses it: TypeScript can't match a generic table's index to its
 *  `leagueId` field, so leagueBatch casts to this. */
type ByLeagueQuery<Table extends TableNames> = {
  withIndex: (
    index: IndexOf<Table>,
    range: (q: { eq: (field: "leagueId", value: Id<"leagues">) => unknown }) => unknown,
  ) => { take: (n: number) => Promise<Doc<Table>[]> };
};

/** A batch of the league's rows in `table`, by its index in leagueIndexes. */
function leagueBatch<Table extends TableNames>(
  ctx: QueryCtx,
  table: Table,
  index: IndexOf<Table>,
  leagueId: Id<"leagues">,
): Promise<Doc<Table>[]> {
  const query = ctx.db.query(table) as unknown as ByLeagueQuery<Table>;
  return query.withIndex(index, (q) => q.eq("leagueId", leagueId)).take(ROWS_PER_RUN);
}

export const tablesKeyedToLeague = Object.keys(leagueIndexes);

/** Deletes a batch of the league's rows in `table`: whether it was a full one, so more may be left. */
async function deleteBatch<Table extends TableNames>(
  ctx: MutationCtx,
  table: Table,
  index: IndexOf<Table>,
  leagueId: Id<"leagues">,
): Promise<boolean> {
  const rows = await leagueBatch(ctx, table, index, leagueId);
  for (const row of rows) await ctx.db.delete(table, row._id);
  return rows.length === ROWS_PER_RUN;
}

/** Everyone with a part in the league but `by`: who is told once it is gone. */
async function othersIn(ctx: QueryCtx, league: Doc<"leagues">, by: string): Promise<string[]> {
  return [...new Set(await wholeLeague(ctx, league))].filter((email) => email !== by);
}

/** The admin or the league's commissioner deletes it, to be gone for good in UNDO_MS, its live
 *  draft paused and its trades in review on hold. */
export const deleteLeague = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const { email: by, league } = await deleterOf(ctx, leagueId);
    const deletesAt = Date.now() + UNDO_MS;
    const scheduledId = await ctx.scheduler.runAt(deletesAt, internal.leagues.leagueDeletion.deleteForGood, { leagueId });
    await ctx.db.patch("leagues", leagueId, { deletion: { by, deletesAt, scheduledId } });
    await pauseForDeletion(ctx, leagueId);
    await pauseReviews(ctx, leagueId);
    await recordEvent(ctx, leagueId, by, { kind: "deletionStarted", name: league.name, deletesAt }, { only: [league.commissionerEmail, by] });
    return null;
  },
});

/** The league's commissioner or the admin, whichever deleted it, undoes it before it is gone, and
 *  it is as it was, but for a draft its deletion paused, which stays paused until he resumes it,
 *  and its trades in review, which end as much later as it was frozen. */
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
    await resumeReviews(ctx, leagueId, Date.now() - (deletion.deletesAt - UNDO_MS));
    await recordEvent(
      ctx,
      leagueId,
      email,
      { kind: "deletionUndone", name: league.name },
      { only: [league.commissionerEmail, deletion.by, email] },
    );
    return null;
  },
});

/** Deletes the league for good: every row keyed to it, a batch of each table a run, then the
 *  league itself last, so it stays frozen and hidden until nothing of it is left. The last run
 *  emails everyone it had (deletionNotices.ts). */
export const deleteForGood = internalMutation({
  args: {
    leagueId: v.id("leagues"),
    /** Whom to email once it is gone: absent on the first run, which reads them before the teams
     *  go and hands them on. */
    tell: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, { leagueId, tell: handedOn }) => {
    const league = await ctx.db.get("leagues", leagueId);
    if (!league?.deletion) throw new Error(`League ${leagueId} isn't being deleted, so it wasn't deleted for good`);
    const tell = handedOn ?? (await othersIn(ctx, league, league.deletion.by));
    let more = false;
    // Object.entries loses which index goes with which table; leagueIndexes' type pairs them.
    for (const [table, index] of Object.entries(leagueIndexes) as [TableNames, IndexOf<TableNames>][]) {
      // Not `more ||= await deleteBatch(...)`: that would skip every table after a full batch.
      const full = await deleteBatch(ctx, table, index, leagueId);
      more ||= full;
    }
    // The league goes last: joining/endedInvite.ts reads an invite's league as always there.
    if (more) {
      await ctx.scheduler.runAfter(0, internal.leagues.leagueDeletion.deleteForGood, { leagueId, tell });
      return null;
    }
    await ctx.db.delete("leagues", leagueId);
    await ctx.scheduler.runAfter(0, internal.leagues.deletionNotices.send, { leagueName: league.name, by: league.deletion.by, emails: tell });
    return null;
  },
});
