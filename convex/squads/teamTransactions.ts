import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { bylineOf } from "../mail/letters";
import { tradedSide } from "../schema";
import { takeShown } from "../shared/cappedRead";
import { managerOf } from "../shared/leagueAccess";
import { isListedMove, type ListedKind, newestFirst } from "./squadPlace";

// My team's Transactions tab (#366; spec/12, My team's tabs: "the team's claims, drops, trades and
// commissioner assignments, newest first, from the same events Mail files"): the commissioner's
// assignments, moves and releases (#31), the manager's drops (#1197) and free agent pickups
// (#1199), the claims a waiver run gives the team (#1198), and each trade that went through as one
// (#383, #1491). Trades made before #1491 filed their players as moves, and still show as moves.

/** How many of the team's latest moves of each kind, by each field naming it, are read: a query's
 *  reads are bounded. Older ones are left out, and `cut` says so. Each read is the team's own
 *  (#1544), so another team's moves never push the team's out. */
export const TRANSACTIONS_READ_OF_EACH_KIND = 1000;

/** Where a listed move names a team: the index reading that field, and the kinds naming a team in
 *  it. A move names the team it went to as `teamId` and the one it came from as `fromTeamId`; a
 *  trade names its two sides as `fromTeamId` and `toTeamId`. */
const TEAM_FIELDS = [
  {
    index: "by_teamId_and_kind_and_at",
    field: "event.teamId",
    kinds: ["playerAssigned", "playerMoved", "playerReleased", "playerDropped", "playerClaimed", "playerPickedUp"],
  },
  { index: "by_fromTeamId_and_kind_and_at", field: "event.fromTeamId", kinds: ["playerMoved", "tradeMade"] },
  { index: "by_toTeamId_and_kind_and_at", field: "event.toTeamId", kinds: ["tradeMade"] },
] as const satisfies readonly { index: string; field: string; kinds: readonly ListedKind[] }[];

const transactionKind = v.union(
  v.literal("assigned"),
  v.literal("movedIn"),
  v.literal("movedOut"),
  v.literal("released"),
  v.literal("dropped"),
  v.literal("claimed"),
  v.literal("pickedUp"),
);

const kindOf = { playerAssigned: "assigned", playerReleased: "released", playerDropped: "dropped", playerClaimed: "claimed", playerPickedUp: "pickedUp" } as const;

/** Who did it: an email, or the admin's byline, as Mail's letter names them. */
const by = v.string();

const playerTransaction = v.object({
  at: v.number(),
  kind: transactionKind,
  playerCode: v.number(),
  playerName: v.string(),
  /** The team a move came from or went to, as it was named then; null for any other kind. */
  otherTeamName: v.union(v.string(), v.null()),
  by,
});

/** A trade that went through, as one (#1491): what it brought the team and what it sent, and the
 *  team on the other side, as named then. `by` is whoever accepted it. */
const tradeTransaction = v.object({
  at: v.number(),
  kind: v.literal("traded"),
  in: tradedSide,
  out: tradedSide,
  otherTeamName: v.string(),
  by,
});

const transaction = v.union(playerTransaction, tradeTransaction);

export const teamTransactions = v.object({
  transactions: v.array(transaction),
  /** Whether the team has squad moves older than those read. */
  cut: v.boolean(),
});
export type TeamTransactions = Infer<typeof teamTransactions>;
type Transaction = Infer<typeof transaction>;

/** The team's transaction in a league event, if it is one. */
function transactionOf({ at, by, event }: Doc<"leagueEvents">, teamId: Id<"teams">): Transaction | null {
  if (!isListedMove(event)) return null;
  const done = { at, by: bylineOf(by) };
  if (event.kind === "tradeMade") {
    if (event.fromTeamId === teamId) return { ...done, kind: "traded", in: event.gets, out: event.gives, otherTeamName: event.toTeamName };
    if (event.toTeamId === teamId) return { ...done, kind: "traded", in: event.gives, out: event.gets, otherTeamName: event.fromTeamName };
    return null;
  }
  const player = { ...done, playerCode: event.playerCode, playerName: event.playerName };
  if (event.kind === "playerMoved") {
    if (event.teamId === teamId) return { ...player, kind: "movedIn", otherTeamName: event.fromTeamName };
    if (event.fromTeamId === teamId) return { ...player, kind: "movedOut", otherTeamName: event.teamName };
    return null;
  }
  if (event.teamId !== teamId) return null;
  return { ...player, kind: kindOf[event.kind], otherTeamName: null };
}

/** The caller's team's transactions in the league, newest first. Refused for anyone who runs no
 *  team in it. */
export const ofMyTeam = query({
  args: { leagueId: v.id("leagues") },
  returns: teamTransactions,
  handler: async (ctx, { leagueId }) => {
    const { team } = await managerOf(ctx, leagueId);
    const ofEachKind = await Promise.all(
      TEAM_FIELDS.flatMap(({ index, field, kinds }) =>
        kinds.map((kind) =>
          takeShown(
            ctx.db
              .query("leagueEvents")
              .withIndex(index, (q) => q.eq(field, team._id).eq("event.kind", kind))
              .order("desc"),
            TRANSACTIONS_READ_OF_EACH_KIND,
          ),
        ),
      ),
    );
    const moves = ofEachKind.flatMap((ofKind) => ofKind.rows).toSorted(newestFirst);
    return {
      transactions: moves.flatMap((row) => transactionOf(row, team._id) ?? []),
      cut: ofEachKind.some((ofKind) => ofKind.more),
    };
  },
});
