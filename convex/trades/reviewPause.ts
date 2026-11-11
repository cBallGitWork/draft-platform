import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { leagueOffers } from "./tradeClose";

// A trade's review while its league is frozen for deletion (#1493). The clock stops: the trade
// doesn't go through while nobody can block it or vote, and after an undo the review carries on
// with the time that was left (Craig, 11 Nov 2026, on #1493: "The clock stops").
// leagueDeletion.ts calls both as it deletes and undoes.

/** The league's trades in review, each with its review. */
async function reviewsIn(ctx: QueryCtx, leagueId: Id<"leagues">) {
  return (await leagueOffers(ctx, leagueId)).flatMap((offer) => (offer.review === undefined ? [] : [{ offer, review: offer.review }]));
}

/** Each trade in review stops its clock as the league is deleted: its timer is cancelled. */
export async function pauseReviews(ctx: MutationCtx, leagueId: Id<"leagues">): Promise<void> {
  for (const { review } of await reviewsIn(ctx, leagueId)) await ctx.scheduler.cancel(review.scheduledId);
}

/** Each trade in review picks up after an undo with the time it had left: its end moves on by
 *  `frozenMs`, how long the league was frozen. */
export async function resumeReviews(ctx: MutationCtx, leagueId: Id<"leagues">, frozenMs: number): Promise<void> {
  for (const { offer, review } of await reviewsIn(ctx, leagueId)) {
    const endsAt = review.endsAt + frozenMs;
    const scheduledId = await ctx.scheduler.runAt(endsAt, internal.trades.tradeReview.finish, { offerId: offer._id });
    await ctx.db.patch("tradeOffers", offer._id, { review: { ...review, endsAt, scheduledId } });
  }
}
