import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { adminByline } from "../mail/letterWords";
import { isAdmin, managerOf } from "../shared/leagueAccess";
import { isSquadMove, SQUAD_MOVES } from "./squadPlace";

// My team's Transactions tab (#366; spec/12, My team's tabs: "the team's claims, drops, trades and
// commissioner assignments, newest first, from the same events Mail files"). Claims, drops and
// trades come with spec/08, so for now it is the commissioner's assignments, moves and releases
// (#31) that touch the team.

/** How many of the league's latest squad moves of each kind are read for the team's: each kind's
 *  read is league-wide, and a query's reads are bounded. Older ones are left out, and `cut` says so. */
export const TRANSACTIONS_READ_OF_EACH_KIND = 1000;

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
  /** Whether the league has squad moves older than those read, which may hold more of the team's. */
  cut: v.boolean(),
});
export type TeamTransactions = Infer<typeof teamTransactions>;
type Transaction = Infer<typeof transaction>;

/** The team's transaction in a league event, if it is one. */
function transactionOf({ at, by, event }: Doc<"leagueEvents">, teamId: Id<"teams">): Transaction | null {
  if (!isSquadMove(event)) return null;
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
    const ofEachKind = await Promise.all(
      SQUAD_MOVES.map((kind) =>
        ctx.db
          .query("leagueEvents")
          .withIndex("by_leagueId_and_kind_and_at", (q) => q.eq("leagueId", leagueId).eq("event.kind", kind))
          .order("desc")
          .take(TRANSACTIONS_READ_OF_EACH_KIND + 1),
      ),
    );
    // Newest first, and of two filed at once the later first, as the league's own index orders them.
    const moves = ofEachKind
      .flatMap((ofKind) => ofKind.slice(0, TRANSACTIONS_READ_OF_EACH_KIND))
      .toSorted((one, other) => other.at - one.at || other._creationTime - one._creationTime);
    return {
      transactions: moves.flatMap((row) => transactionOf(row, team._id) ?? []),
      cut: ofEachKind.some((ofKind) => ofKind.length > TRANSACTIONS_READ_OF_EACH_KIND),
    };
  },
});
