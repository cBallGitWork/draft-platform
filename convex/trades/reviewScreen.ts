import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { positionsNow } from "../positions/playerPositions";
import { isAdmin, memberOf, runnerOf, teamsOf } from "../shared/leagueAccess";
import { clubsByCode } from "../shared/players";
import { leagueOffers } from "./tradeClose";
import { namedPicks, teamNameIn, tradedPlayer } from "./tradedPlayers";
import { votersAmong } from "./tradeReviewers";
import { termsShown } from "./tradeScreen";

// The trades the caller reviews, for the Offers tab's To review group (#383; Craig, 10 Nov 2026):
// under a veto, those he may Block, and for the admin every one (S08.28); under a vote, those he may vote Against, with only his own vote
// shown, never the count, until the review ends. A commissioner with no team of his own sees them
// too, so the gate is a member's, not a manager's. And every trade in review, for League settings
// (#2504).

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
  picks: namedPicks,
  note: v.union(v.string(), v.null()),
  reviewEndsAt: v.number(),
  yours: yourReview,
});
export type TradeToReview = Infer<typeof tradeToReview>;

/** What `email` may do to the trade in review, or null if he doesn't review it: `teams` are the
 *  league's. */
function yoursOn(
  teams: readonly Doc<"teams">[],
  offer: Doc<"tradeOffers">,
  email: string,
): YourReview | null {
  if (offer.review === undefined) return null;
  const { reviewer } = offer.review;
  if (reviewer.kind === "veto") return reviewer.by === email || isAdmin(email) ? "block" : null;
  if (!votersAmong(teams, offer).includes(email)) return null;
  return reviewer.against.includes(email) ? "takeBack" : "against";
}

/** The trades in review the caller reviews, the soonest to end first. */
export const toReview = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(tradeToReview),
  handler: async (ctx, { leagueId }) => {
    const { email } = await memberOf(ctx, leagueId);
    const teams = await teamsOf(ctx, leagueId);
    const nameOf = (teamId: Id<"teams">) => teamNameIn(teams, teamId, "A trade in review");
    const positionsOf = await positionsNow(ctx, leagueId);
    const clubOf = clubsByCode(ctx);
    const shown: TradeToReview[] = [];
    for (const offer of await leagueOffers(ctx, leagueId)) {
      const yours = yoursOn(teams, offer, email);
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

const tradeInReview = v.object({
  offerId: v.id("tradeOffers"),
  fromTeamName: v.string(),
  toTeamName: v.string(),
  reviewEndsAt: v.number(),
  /** Whether Offers shows it to the caller, who reviews it or whose team is in it, so it opens. */
  opens: v.boolean(),
});
export type TradeInReview = Infer<typeof tradeInReview>;

/** Every trade in review in the league, the soonest to end first, for League settings' In review
 *  widget, those the caller can't review among them (Craig, 17 Nov 2026, on #2504: "Every trade in
 *  review in the league"). */
export const inLeague = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(tradeInReview),
  handler: async (ctx, { leagueId }) => {
    const { email } = await runnerOf(ctx, leagueId);
    const teams = await teamsOf(ctx, leagueId);
    const nameOf = (teamId: Id<"teams">) => teamNameIn(teams, teamId, "A trade in review");
    const ownTeamId = teams.find((team) => team.managerEmail === email)?._id;
    const shown: TradeInReview[] = [];
    for (const offer of await leagueOffers(ctx, leagueId)) {
      if (offer.review === undefined) continue;
      const inIt = offer.fromTeamId === ownTeamId || offer.toTeamId === ownTeamId;
      shown.push({
        offerId: offer._id,
        fromTeamName: nameOf(offer.fromTeamId),
        toTeamName: nameOf(offer.toTeamId),
        reviewEndsAt: offer.review.endsAt,
        opens: inIt || yoursOn(teams, offer, email) !== null,
      });
    }
    return shown.sort((one, other) => one.reviewEndsAt - other.reviewEndsAt);
  },
});
