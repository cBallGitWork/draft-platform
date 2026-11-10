import { defineTable } from "convex/server";
import { v } from "convex/values";

// Trades (#383, spec/08 Trades): each offer still open or in review, one row each. An offer that
// closes, a trade that goes through and one that is blocked all leave this table; Mail and the
// squad moves they file (../trades/) say what happened. One that ends without going through is
// kept in `closedTradeOffers`, for the Trades screen's Closed offers (docs/design/approved/trades).

/** Who reviews an accepted trade (../trades/tradeReview.ts): the one person who may block it, or
 *  the managers voting, and those who have voted against so far. */
export const tradeReviewer = v.union(
  v.object({ kind: v.literal("veto"), by: v.string() }),
  v.object({ kind: v.literal("vote"), against: v.array(v.string()) }),
);

/** A draft pick in a trade (#1096): `teamId`'s pick in `round`, whoever holds it now. A traded pick
 *  is a team's pick in a round, not a fixed slot (Craig, 8 Nov 2026). */
export const tradePick = v.object({ round: v.number(), teamId: v.id("teams") });

/** Why an offer ended without going through: answered (withdrawn, rejected, countered), closed by
 *  the platform (../mail/tradeLetterWords.ts `OfferClosed`), blocked in review, or unmade at its
 *  review's end. */
export const closedWhy = v.union(
  v.literal("withdrawn"),
  v.literal("rejected"),
  v.literal("countered"),
  v.literal("deadline"),
  v.literal("tradeDeadline"),
  v.literal("unusedGameweek"),
  v.literal("draftStarted"),
  v.literal("pickTraded"),
  v.literal("autoTeam"),
  v.literal("playerLeft"),
  v.literal("blocked"),
  v.literal("failed"),
);

export const tradeTables = {
  tradeOffers: defineTable({
    leagueId: v.id("leagues"),
    /** The team whose manager made the offer, and the team it is to. */
    fromTeamId: v.id("teams"),
    toTeamId: v.id("teams"),
    /** The players going from `fromTeamId` to `toTeamId`, by FPL's season-stable code. */
    gives: v.array(v.number()),
    /** The players coming from `toTeamId` to `fromTeamId`. */
    gets: v.array(v.number()),
    /** A pick trade's picks, one each way, before the draft starts (spec/04, The picks): the pick
     *  going from `fromTeamId` and the one coming back. Its `gives` and `gets` are then empty, as an
     *  offer with a pick in it holds nothing else (Craig, 8 Nov 2026). Absent from a players' trade. */
    picks: v.optional(v.object({ gives: tradePick, gets: tradePick })),
    /** Its one-line note; absent with none. */
    note: v.optional(v.string()),
    /** Who made it, by email. */
    by: v.string(),
    madeAt: v.number(),
    /** Present once it is accepted, while it is in review: who accepted it, when the review ends,
     *  the timer that ends it, and who reviews it. */
    review: v.optional(
      v.object({
        acceptedBy: v.string(),
        endsAt: v.number(),
        scheduledId: v.id("_scheduled_functions"),
        reviewer: tradeReviewer,
      }),
    ),
  })
    .index("by_leagueId", ["leagueId"])
    .index("by_madeAt", ["madeAt"]),
  /** An offer that ended without going through, kept as it was made, with when and why. */
  closedTradeOffers: defineTable({
    leagueId: v.id("leagues"),
    fromTeamId: v.id("teams"),
    toTeamId: v.id("teams"),
    gives: v.array(v.number()),
    gets: v.array(v.number()),
    picks: v.optional(v.object({ gives: tradePick, gets: tradePick })),
    note: v.optional(v.string()),
    by: v.string(),
    madeAt: v.number(),
    closedAt: v.number(),
    why: closedWhy,
  })
    .index("by_leagueId", ["leagueId"])
    .index("by_fromTeamId_and_closedAt", ["fromTeamId", "closedAt"])
    .index("by_toTeamId_and_closedAt", ["toTeamId", "closedAt"]),
};
