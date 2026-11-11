import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { positionsNow } from "../positions/playerPositions";
import { memberOf, teamsOf } from "../shared/leagueAccess";
import { clubsByCode } from "../shared/players";
import { leagueOffers } from "./tradeClose";
import { tradedPlayer } from "./tradedPlayers";
import { votersOn } from "./tradeReviewers";
import { termsShown } from "./tradeScreen";

// The trades the caller reviews, for the Offers tab's To review group (#383; Craig, 10 Nov 2026):
// under a veto, those he may Block; under a vote, those he may vote Against, with only his own vote
// shown, never the count, until the review ends. A commissioner with no team of his own sees them
// too, so the gate is a member's, not a manager's.

/** What the caller may do to a trade he reviews: Block it, vote Against it, or take his Against
 *  back. */
const yourReview = v.union(
  v.literal("block"),
  v.literal("against"),
  v.literal("takeBack"),
);
export type YourReview = Infer<typeof yourReview>;

const tradeToReview = v.object({
  offerId: v.id("tradeOffers"),
  fromTeamName: v.string(),
  toTeamName: v.string(),
  /** The players going from the offer's maker, and those coming back. */
  gives: v.array(tradedPlayer),
  gets: v.array(tradedPlayer),
  /** A pick trade's picks, each as its letters name it; null for a players' trade. */
  picks: v.union(v.object({ gives: v.string(), gets: v.string() }), v.null()),
  note: v.union(v.string(), v.null()),
  reviewEndsAt: v.number(),
  yours: yourReview,
});
export type TradeToReview = Infer<typeof tradeToReview>;

/** What `email` may do to the trade in review, or null if he doesn't review it. */
async function yoursOn(
  ctx: QueryCtx,
  offer: Doc<"tradeOffers">,
  email: string,
): Promise<YourReview | null> {
  if (offer.review === undefined) return null;
  const { reviewer } = offer.review;
  if (reviewer.kind === "veto") return reviewer.by === email ? "block" : null;
  if (!(await votersOn(ctx, offer)).includes(email)) return null;
  return reviewer.against.includes(email) ? "takeBack" : "against";
}

/** The trades in review the caller reviews, the soonest to end first. */
export const toReview = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(tradeToReview),
  handler: async (ctx, { leagueId }) => {
    const { email } = await memberOf(ctx, leagueId);
    const teams = await teamsOf(ctx, leagueId);
    const nameOf = (teamId: Id<"teams">) => {
      const team = teams.find((each) => each._id === teamId);
      if (team === undefined)
        throw new Error(`A trade in review names team ${teamId}, which isn't in its league`);
      return team.name;
    };
    const positionsOf = await positionsNow(ctx, leagueId);
    const clubOf = clubsByCode(ctx);
    const shown: TradeToReview[] = [];
    for (const offer of await leagueOffers(ctx, leagueId)) {
      const yours = await yoursOn(ctx, offer, email);
      if (yours === null || offer.review === undefined) continue;
      shown.push({
        offerId: offer._id,
        fromTeamName: nameOf(offer.fromTeamId),
        toTeamName: nameOf(offer.toTeamId),
        ...(await termsShown(ctx, offer, positionsOf, clubOf)),
        note: offer.note ?? null,
        reviewEndsAt: offer.review.endsAt,
        yours,
      });
    }
    return shown.sort((one, other) => one.reviewEndsAt - other.reviewEndsAt);
  },
});
