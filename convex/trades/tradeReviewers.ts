import type { Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { LeagueDeadlines } from "../gameweeks/deadline";
import { fileLetter } from "../mail/letters";
import { reviewLetter, type ReviewWords } from "../mail/tradeLetterWords";
import { tradeRulesOf } from "../rules/firstRules";
import { rulesSinceBegun } from "../rules/rulesHistory";
import type { tradeReviewer } from "../schema/trades";
import { teamsOf } from "../shared/leagueAccess";
import { latestBegun } from "../waivers/waiverLock";
import { leagueOffers } from "./tradeClose";
import { leagueOf, managersOf, tradeWordsOf } from "./tradeWords";
import { onAutoTeam } from "../lineup/autoTeam";

// Who reviews an accepted trade (spec/08 Trades; #383): under a commissioner veto, the
// commissioner, or the co-commissioner when he is in it, or a league vote when there is none;
// under a vote, the managers of the other teams still playing. A veto follows the role, not the
// person: a change of commissioner or co-commissioner passes the trade on (#1472).

/** The managers who vote on a trade: those of the other teams, but not one on the auto team. */
export async function votersOn(ctx: QueryCtx, offer: Doc<"tradeOffers">): Promise<string[]> {
  return (await teamsOf(ctx, offer.leagueId)).flatMap((team) =>
    team._id === offer.fromTeamId || team._id === offer.toTeamId || onAutoTeam(team) || team.managerEmail === undefined ? [] : [team.managerEmail],
  );
}

/** Who reviews the trade under the league's rules in force at `now`, not a change waiting for the
 *  next gameweek (#1473), or null for nobody: the commissioner under a veto, the co-commissioner
 *  when he is in it, or a vote when there is none (or the co-commissioner is in it too). */
export async function reviewerOf(ctx: QueryCtx, league: Doc<"leagues">, offer: Doc<"tradeOffers">, deadlines: LeagueDeadlines, now: number): Promise<ReviewWords | null> {
  const { review } = tradeRulesOf(await rulesSinceBegun(ctx, league._id, latestBegun(deadlines, now)));
  if (review !== "veto") return review === "vote" ? { kind: "vote" } : null;
  return reviewOf(await vetoerOf(ctx, league, offer));
}

/** Under a veto, the review its vetoer gives: he blocks it, or with nobody who may, a vote. */
function reviewOf(by: string | undefined): ReviewWords {
  return by === undefined ? { kind: "vote" } : { kind: "veto", by };
}

/** The review as the offer keeps it: a vote starts with nobody against. */
export function storedReviewer(review: ReviewWords): Infer<typeof tradeReviewer> {
  return review.kind === "veto" ? review : { kind: "vote", against: [] };
}

/** Who gets the review letter: the vetoer, or under a vote the managers who may vote. */
export async function reviewersOf(ctx: QueryCtx, offer: Doc<"tradeOffers">, review: ReviewWords): Promise<string[]> {
  return review.kind === "veto" ? [review.by] : await votersOn(ctx, offer);
}

/** Under a veto, who blocks the trade now: the commissioner, or the co-commissioner when he is in
 *  it; undefined when neither may. */
async function vetoerOf(ctx: QueryCtx, league: Doc<"leagues">, offer: Doc<"tradeOffers">): Promise<string | undefined> {
  const inIt = new Set(await managersOf(ctx, offer));
  return [league.commissionerEmail, league.coCommissionerEmail].find((email) => email !== undefined && !inIt.has(email));
}

/** After the commissioner or co-commissioner changes, each trade in review under a veto goes to
 *  whoever holds the role now (#1472; Craig, 11 Nov 2026): he gets the review letter and may Block
 *  it, the one who left may not, and the 24 hours don't restart. With nobody left who may block
 *  it, it goes to a league vote, as a trade the commissioner is in does with no co-commissioner. */
export async function passReviews(ctx: MutationCtx, leagueId: Id<"leagues">): Promise<void> {
  const league = await leagueOf(ctx, leagueId);
  for (const offer of await leagueOffers(ctx, leagueId)) {
    const { review } = offer;
    if (review?.reviewer.kind !== "veto") continue;
    const by = await vetoerOf(ctx, league, offer);
    if (by === review.reviewer.by) continue;
    const now = reviewOf(by);
    await ctx.db.patch("tradeOffers", offer._id, { review: { ...review, reviewer: storedReviewer(now) } });
    const words = await tradeWordsOf(ctx, offer);
    await fileLetter(ctx, league, await reviewersOf(ctx, offer, now), (tell) => reviewLetter(words, now, review.endsAt, tell));
  }
}
