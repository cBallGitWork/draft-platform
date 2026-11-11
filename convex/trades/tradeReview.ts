import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { MOST_IN_SQUAD } from "../leagues/leagueLimits";
import { pickFirstLineupAgain } from "../lineup/lineups";
import { knownOnJoining } from "../positions/positionWarnings";
import { fileEvent, fileLetter, wholeLeague } from "../mail/letters";
import {
  acceptedLetter,
  reviewLetter,
  tradeBlockedLetter,
  tradeFailedLetter,
  tradeMadeLetter,
  type ReviewWords,
  type TradeFailed,
  type TradeWords,
} from "../mail/tradeLetterWords";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { managerOf, memberOf, refuse, teamIn } from "../shared/leagueAccess";
import { placeOf } from "../squads/squadPlace";
import { closeOffersHolding, endOffer } from "./tradeClose";
import { leagueOf, managersOf, tradedName, tradedSideOf, tradeWordsOf } from "./tradeWords";
import { REVIEW_MS } from "./tradeLimits";
import { movePicks } from "./tradePicks";
import { reviewerOf, votersOn } from "./tradeReviewers";
import { squadFullRefusal, squadsAfter, tradeWarnings } from "./tradeSquads";

// A trade's review and its move (spec/08 Trades; #383). Accepted, a trade goes through at once in
// a league with no review. Under a commissioner veto, the commissioner has 24 hours to block it;
// a trade he is in goes to the co-commissioner, or to a league vote if there is none. Under a
// league vote, the managers of the other teams still playing (not on the auto team) have 24 hours,
// and it is blocked only if most of them vote against; a voter can take his Against back until the
// 24 hours are up (`takeBack`; Craig, 10 Nov 2026); with none of them, it goes through at once
// (S08.15; Craig, 11 Nov 2026, on #1607). Either way the reviewers get a Mail letter to act on, a
// blocked trade files a letter to the whole league, and one that clears review the
// usual trade letter. Once through, the trade is filed as one `tradeMade`, which the screens list
// (#1491), and its players move at once, each filed as a `playerTraded` for the squads' history; a
// gameweek already under way keeps their points with the old team, as the commissioner's move
// does. Any other open offer holding one of them closes. A pick trade's picks change owner instead
// (tradePicks.ts; #1096).

export const reviewRefusals = {
  notInReview: "That trade isn't in review.",
  notYourBlock: "Only the person reviewing that trade can block it.",
  notYourVote: "Only the managers of the other teams still playing can vote on that trade.",
  votedAlready: "You have voted against that trade already.",
  notVoted: "You haven't voted against that trade.",
  squadFull: squadFullRefusal,
};

/** The accepted offer goes into review, or through at once with none. */
export async function startReview(ctx: MutationCtx, offer: Doc<"tradeOffers">, acceptedBy: string): Promise<void> {
  const league = await leagueOf(ctx, offer.leagueId);
  const review = await reviewerOf(ctx, league, offer, await leagueDeadlines(ctx, league._id), Date.now());
  const reviewers = review === null ? [] : review.kind === "veto" ? [review.by] : await votersOn(ctx, offer);
  // A vote nobody may cast goes through at once, as with no review (Craig, 11 Nov 2026, on #1607).
  if (review === null || reviewers.length === 0) {
    await goThrough(ctx, offer, acceptedBy, true);
    return;
  }
  const endsAt = Date.now() + REVIEW_MS;
  const scheduledId = await ctx.scheduler.runAt(endsAt, internal.trades.tradeReview.finish, { offerId: offer._id });
  const reviewer = review.kind === "veto" ? review : { kind: "vote" as const, against: [] };
  await ctx.db.patch("tradeOffers", offer._id, { review: { acceptedBy, endsAt, scheduledId, reviewer } });
  const words = await tradeWordsOf(ctx, offer);
  await fileLetter(ctx, league, await managersOf(ctx, offer), (tell) => acceptedLetter(words, review, endsAt, tell), acceptedBy);
  await fileLetter(ctx, league, reviewers, (tell) => reviewLetter(words, review, endsAt, tell));
}

/** The player in the trade no longer on his side's team, if one is. */
async function playerGone(ctx: QueryCtx, offer: Doc<"tradeOffers">) {
  const sides = [
    ...offer.gives.map((playerCode) => ({ playerCode, teamId: offer.fromTeamId })),
    ...offer.gets.map((playerCode) => ({ playerCode, teamId: offer.toTeamId })),
  ];
  for (const side of sides) if ((await placeOf(ctx, offer.leagueId, side.playerCode))?.teamId !== side.teamId) return side;
  return null;
}

/** Why the trade can't be made now, if it can't: a player in it has left his side's team, or, at a
 *  review's end, a team would hold more than the most in a squad, filled meanwhile by another trade
 *  or an assignment. Accepted with no review, that is the accepter's refusal (`tradeWarnings`). */
async function cantMake(ctx: QueryCtx, offer: Doc<"tradeOffers">, watched: boolean): Promise<TradeFailed | null> {
  const gone = await playerGone(ctx, offer);
  if (gone !== null) {
    const team = await teamIn(ctx, offer.leagueId, gone.teamId);
    return { why: "playerGone", playerName: await tradedName(ctx, gone.playerCode), teamName: team.name };
  }
  if (watched || offer.picks !== undefined) return null;
  for (const { teamId, codes } of await squadsAfter(ctx, offer)) {
    if (codes.length > MOST_IN_SQUAD) return { why: "squadFull", teamName: (await teamIn(ctx, offer.leagueId, teamId)).name };
  }
  return null;
}

/** Closes the trade unmade, telling both managers why. */
async function failTrade(ctx: MutationCtx, offer: Doc<"tradeOffers">, words: TradeWords, failed: TradeFailed): Promise<void> {
  await endOffer(ctx, offer, "failed");
  await fileLetter(ctx, await leagueOf(ctx, offer.leagueId), await managersOf(ctx, offer), tradeFailedLetter(words, failed));
}

/** Makes the trade: its players move at once, the league gets the usual trade letter, each team's
 *  first lineup is picked again, and any other open offer holding one of them closes. If it can't
 *  be made (`cantMake`), nobody moves and both managers are told. The letter is filed read for `by`
 *  only when `watched`: accepted with no review, not at a review's end. A throw must roll back the
 *  whole mutation, so the caller never catches it in the same transaction (`makeAtReviewEnd`). */
async function goThrough(ctx: MutationCtx, offer: Doc<"tradeOffers">, by: string, watched: boolean): Promise<void> {
  const league = await leagueOf(ctx, offer.leagueId);
  const words = await tradeWordsOf(ctx, offer);
  const failed = await cantMake(ctx, offer, watched);
  if (failed !== null) {
    await failTrade(ctx, offer, words, failed);
    return;
  }
  await ctx.db.delete("tradeOffers", offer._id);
  const [from, to] = await Promise.all([ctx.db.get("teams", offer.fromTeamId), ctx.db.get("teams", offer.toTeamId)]);
  if (from === null || to === null) throw new Error(`Trade offer ${offer._id} is between teams that no longer exist`);
  await fileEvent(ctx, league._id, by, {
    kind: "tradeMade",
    fromTeamId: from._id,
    fromTeamName: from.name,
    toTeamId: to._id,
    toTeamName: to.name,
    gives: await tradedSideOf(ctx, offer.gives, offer.picks?.gives),
    gets: await tradedSideOf(ctx, offer.gets, offer.picks?.gets),
  });
  if (offer.picks !== undefined) {
    await movePicks(ctx, offer, offer.picks);
    await fileLetter(ctx, league, await wholeLeague(ctx, league), tradeMadeLetter(words, []), watched ? by : undefined);
    return;
  }
  const warnings = await tradeWarnings(ctx, league._id, offer);
  const moves = [
    ...offer.gives.map((playerCode) => ({ playerCode, out: from, into: to })),
    ...offer.gets.map((playerCode) => ({ playerCode, out: to, into: from })),
  ];
  for (const { playerCode, out, into } of moves) {
    const place = await placeOf(ctx, league._id, playerCode);
    if (place === null) throw new Error(`Player ${playerCode} left his squad while his trade was made`);
    // A new team starts him afresh, as a move does: on no number of its own (spec/05 Squad
    // numbers), and never its free-agent pickup, so its drop sends him to waivers (#1479).
    await ctx.db.patch("squadPlayers", place._id, { teamId: into._id, number: undefined, pickedUpAt: undefined });
    await knownOnJoining(ctx, league._id, into._id, playerCode);
    await fileEvent(ctx, league._id, by, {
      kind: "playerTraded",
      playerCode,
      playerName: await tradedName(ctx, playerCode),
      teamId: into._id,
      teamName: into.name,
      fromTeamId: out._id,
      fromTeamName: out.name,
    });
  }
  const overLimits = warnings.filter(({ warnings }) => warnings.length > 0).map(({ teamName }) => teamName);
  await fileLetter(ctx, league, await wholeLeague(ctx, league), tradeMadeLetter(words, overLimits), watched ? by : undefined);
  await pickFirstLineupAgain(ctx, league._id, from._id);
  await pickFirstLineupAgain(ctx, league._id, to._id);
  await closeOffersHolding(ctx, league._id, from._id, offer.gives);
  await closeOffersHolding(ctx, league._id, to._id, offer.gets);
}

/** Blocks the trade: nobody moves, its timer is cancelled, and the whole league is told. */
async function blockTrade(ctx: MutationCtx, offer: Doc<"tradeOffers">, review: ReviewWords, by?: string): Promise<void> {
  const league = await leagueOf(ctx, offer.leagueId);
  const words = await tradeWordsOf(ctx, offer);
  if (offer.review !== undefined) await ctx.scheduler.cancel(offer.review.scheduledId);
  await endOffer(ctx, offer, "blocked");
  await fileLetter(ctx, league, await wholeLeague(ctx, league), tradeBlockedLetter(words, review), by);
}

/** The offer in review in the league, or the refusal that it isn't. */
async function inReview(ctx: QueryCtx, leagueId: Id<"leagues">, offerId: Id<"tradeOffers">) {
  const offer = await ctx.db.get("tradeOffers", offerId);
  if (offer === null || offer.leagueId !== leagueId || offer.review === undefined) refuse(reviewRefusals.notInReview);
  return { ...offer, review: offer.review };
}

/** Under a veto, its reviewer blocks the trade. */
export const block = mutation({
  args: { leagueId: v.id("leagues"), offerId: v.id("tradeOffers") },
  returns: v.null(),
  handler: async (ctx, { leagueId, offerId }) => {
    const { email } = await memberOf(ctx, leagueId);
    const offer = await inReview(ctx, leagueId, offerId);
    const { reviewer } = offer.review;
    if (reviewer.kind !== "veto" || reviewer.by !== email) refuse(reviewRefusals.notYourBlock);
    await blockTrade(ctx, offer, reviewer, email);
    return null;
  },
});

/** The caller, the trade's Against votes and a way to set them, if the caller may vote on it. */
async function voteOf(ctx: MutationCtx, leagueId: Id<"leagues">, offerId: Id<"tradeOffers">) {
  const { email } = await managerOf(ctx, leagueId);
  const offer = await inReview(ctx, leagueId, offerId);
  const { reviewer } = offer.review;
  if (reviewer.kind !== "vote" || !(await votersOn(ctx, offer)).includes(email)) refuse(reviewRefusals.notYourVote);
  const setAgainst = (against: string[]) =>
    ctx.db.patch("tradeOffers", offer._id, { review: { ...offer.review, reviewer: { ...reviewer, against } } });
  return { email, against: reviewer.against, setAgainst };
}

/** Under a vote, a manager of another team still playing votes against the trade. */
export const against = mutation({
  args: { leagueId: v.id("leagues"), offerId: v.id("tradeOffers") },
  returns: v.null(),
  handler: async (ctx, { leagueId, offerId }) => {
    const { email, against, setAgainst } = await voteOf(ctx, leagueId, offerId);
    if (against.includes(email)) refuse(reviewRefusals.votedAlready);
    await setAgainst([...against, email]);
    return null;
  },
});

/** Under a vote, a manager takes his Against back until the review's 24 hours are up, in case of a
 *  typo (Craig, 10 Nov 2026, on #383). Once they are, the trade is no longer in review. */
export const takeBack = mutation({
  args: { leagueId: v.id("leagues"), offerId: v.id("tradeOffers") },
  returns: v.null(),
  handler: async (ctx, { leagueId, offerId }) => {
    const { email, against, setAgainst } = await voteOf(ctx, leagueId, offerId);
    if (!against.includes(email)) refuse(reviewRefusals.notVoted);
    await setAgainst(against.filter((each) => each !== email));
    return null;
  },
});

/** Whether most of the managers still playing voted against the trade: more than half of those
 *  who may vote now, counting only their votes. */
export function mostAgainst(voters: readonly string[], against: readonly string[]): boolean {
  const counted = against.filter((email) => voters.includes(email)).length;
  return counted * 2 > voters.length;
}

/** The trade made at its review's end, run by `finish` as its own sub-transaction: a throw part-way
 *  rolls back every write it made, so the trade is whole or not made at all. */
export const makeAtReviewEnd = internalMutation({
  args: { offerId: v.id("tradeOffers") },
  returns: v.null(),
  handler: async (ctx, { offerId }) => {
    const offer = await ctx.db.get("tradeOffers", offerId);
    if (offer?.review === undefined) return null;
    await goThrough(ctx, offer, offer.review.acceptedBy, false);
    return null;
  },
});

/** Nothing retries a review's end, so a trade it can't make closes rather than throw and hold its
 *  players for good (#1325): logged, and both managers told when its words can still be read. The
 *  throw rolled its writes back, so nobody has moved. */
async function closeUnmade(ctx: MutationCtx, offer: Doc<"tradeOffers">, error: unknown): Promise<void> {
  console.error(`Trade offer ${offer._id} couldn't be made at its review's end, so it closed:`, error);
  const words = await tradeWordsOf(ctx, offer).catch((wordsError: unknown) => {
    console.error(`Trade offer ${offer._id}'s words couldn't be read, so it closed with no letters:`, wordsError);
    return null;
  });
  if (words === null) await endOffer(ctx, offer, "failed");
  else await failTrade(ctx, offer, words, { why: "error" });
}

/** The review's 24 hours are up: blocked if most voted against, through otherwise. A trade already
 *  blocked, or a league since deleted, leaves no offer, and nothing happens. */
export const finish = internalMutation({
  args: { offerId: v.id("tradeOffers") },
  returns: v.null(),
  handler: async (ctx, { offerId }) => {
    const offer = await ctx.db.get("tradeOffers", offerId);
    if (offer === null || offer.review === undefined) return null;
    const { reviewer } = offer.review;
    if (reviewer.kind === "vote" && mostAgainst(await votersOn(ctx, offer), reviewer.against)) {
      await blockTrade(ctx, offer, { kind: "vote" });
      return null;
    }
    try {
      const made: null = await ctx.runMutation(internal.trades.tradeReview.makeAtReviewEnd, { offerId });
      return made;
    } catch (error) {
      await closeUnmade(ctx, offer, error);
    }
    return null;
  },
});
