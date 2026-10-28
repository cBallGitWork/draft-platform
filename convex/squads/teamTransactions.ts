import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { adminByline } from "../mail/letterWords";
import { isAdmin, managerOf } from "../shared/leagueAccess";

// My team's Transactions tab (#366; spec/12, My team's tabs: "the team's claims, drops, trades and
// commissioner assignments, newest first, from the same events Mail files"). Claims, drops and
// trades come with spec/08, so for now it is the commissioner's assignments, moves and releases
// (#31) that touch the team.

/** How many of the league's latest events are searched for the team's: every kind of event is
 *  filed in one list, and a query's reads are bounded. Older ones are left out, and `cut` says so. */
export const EVENTS_SEARCHED = 1000;

const transactionKind = v.union(v.literal("assigned"), v.literal("movedIn"), v.literal("movedOut"), v.literal("released"));

const transaction = v.object({
  at: v.number(),
  kind: transactionKind,
  playerCode: v.number(),
  playerName: v.string(),
  /** The team a move came from or went to, as it was named then; null for any other kind. */
  otherTeamName: v.union(v.string(), v.null()),
  /** Who did it: an email, or the admin's byline, as Mail's letter names them. */
  by: v.string(),
});

export const teamTransactions = v.object({
  transactions: v.array(transaction),
  /** Whether the league has events older than those searched, which may hold more of the team's. */
  cut: v.boolean(),
});
export type TeamTransactions = Infer<typeof teamTransactions>;
type Transaction = Infer<typeof transaction>;

/** The team's transaction in a league event, if it is one. */
function transactionOf({ at, by, event }: Doc<"leagueEvents">, teamId: Id<"teams">): Transaction | null {
  if (event.kind !== "playerAssigned" && event.kind !== "playerReleased" && event.kind !== "playerMoved") return null;
  const done = { at, by: isAdmin(by) ? adminByline : by, playerCode: event.playerCode, playerName: event.playerName };
  if (event.kind === "playerMoved") {
    if (event.teamId === teamId) return { ...done, kind: "movedIn", otherTeamName: event.fromTeamName };
    if (event.fromTeamId === teamId) return { ...done, kind: "movedOut", otherTeamName: event.teamName };
    return null;
  }
  if (event.teamId !== teamId) return null;
  return { ...done, kind: event.kind === "playerAssigned" ? "assigned" : "released", otherTeamName: null };
}

/** The caller's team's transactions in the league, newest first. Refused for anyone who runs no
 *  team in it. */
export const ofMyTeam = query({
  args: { leagueId: v.id("leagues") },
  returns: teamTransactions,
  handler: async (ctx, { leagueId }) => {
    const { team } = await managerOf(ctx, leagueId);
    const events = await ctx.db
      .query("leagueEvents")
      .withIndex("by_leagueId_and_at", (q) => q.eq("leagueId", leagueId))
      .order("desc")
      .take(EVENTS_SEARCHED + 1);
    const searched = events.slice(0, EVENTS_SEARCHED);
    return {
      transactions: searched.flatMap((row) => transactionOf(row, team._id) ?? []),
      cut: events.length > EVENTS_SEARCHED,
    };
  },
});
