import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { MOST_IN_SQUAD } from "../leagues/leagueLimits";
import { pickFirstLineupAgain } from "../lineup/lineups";
import { fileEvent, fileLetter, wholeLeague } from "../mail/letters";
import { acceptedLetter, reviewLetter, tradeBlockedLetter, tradeFailedLetter, tradeMadeLetter, type ReviewWords } from "../mail/tradeLetterWords";
import { tradeRulesOf } from "../rules/firstRules";
import { latestRules } from "../rules/rulesHistory";
import { managerOf, memberOf, refuse, teamsOf } from "../shared/leagueAccess";
import { DAY_MS } from "../shared/time";
import { placeOf, squadOf } from "../squads/squadPlace";
import { limitsBroken, type SquadWarning } from "../squads/squads";
import { closeOffersHolding, leagueOf, managersOf, tradedName, tradeWordsOf } from "./tradeClose";
import { onAutoTeam } from "./tradeShut";

// A trade's review and its move (spec/08 Trades; #383). Accepted, a trade goes through at once in
// a league with no review. Under a commissioner veto, the commissioner has 24 hours to block it;
// a trade he is in goes to the co-commissioner, or to a league vote if there is none. Under a
// league vote, the managers of the other teams still playing (not on the auto team) have 24 hours,
// and it is blocked only if most of them vote against. Either way the reviewers get a Mail letter
// to act on, a blocked trade files a letter to the whole league, and one that clears review the
// usual trade letter. Once through, its players move at once: the commissioner's own move
// (../squads/squads.ts `move`) is filed for each, and a gameweek already under way keeps their
// points with the old team, as that move does. Any other open offer holding one of them closes.

/** How long a review lasts (spec/08: "24 hours"). Craig's answer, so a constant. */
export const REVIEW_MS = DAY_MS;

export const reviewRefusals = {
  notInReview: "That trade isn't in review.",
  notYourBlock: "Only the person reviewing that trade can block it.",
  notYourVote: "Only the managers of the other teams still playing can vote on that trade.",
  votedAlready: "You have voted against that trade already.",
  squadFull: `A team holds at most ${MOST_IN_SQUAD} players.`,
};

/** Each team's squad as it would be once the trade is made, by code. */
export async function squadsAfter(ctx: QueryCtx, offer: Pick<Doc<"tradeOffers">, "fromTeamId" | "toTeamId" | "gives" | "gets">) {
  const after = async (teamId: Id<"teams">, out: readonly number[], into: readonly number[]) => [
    ...(await squadOf(ctx, teamId)).map((row) => row.playerCode).filter((code) => !out.includes(code)),
    ...into,
  ];
  return [
    { teamId: offer.fromTeamId, codes: await after(offer.fromTeamId, offer.gives, offer.gets) },
    { teamId: offer.toTeamId, codes: await after(offer.toTeamId, offer.gets, offer.gives) },
  ];
}

/** The league's squad limits each team's squad would break once the trade is made, which warn but
 *  don't stop it (spec/08, as an assignment's, spec/15). Refused past the platform's most in a squad. */
export async function tradeWarnings(ctx: QueryCtx, leagueId: Id<"leagues">, offer: Parameters<typeof squadsAfter>[1]) {
  const squad = (await latestRules(ctx, leagueId))?.squad ?? null;
  return Promise.all(
    (await squadsAfter(ctx, offer)).map(async ({ teamId, codes }) => {
      if (codes.length > MOST_IN_SQUAD) refuse(reviewRefusals.squadFull);
      const team = await ctx.db.get("teams", teamId);
      const warnings: SquadWarning[] = await limitsBroken(ctx, leagueId, codes, squad);
      return { teamId, teamName: team?.name ?? "", warnings };
    }),
  );
}

/** The managers who vote on a trade: those of the other teams, but not one on the auto team. */
async function votersOn(ctx: QueryCtx, offer: Doc<"tradeOffers">): Promise<string[]> {
  return (await teamsOf(ctx, offer.leagueId)).flatMap((team) =>
    team._id === offer.fromTeamId || team._id === offer.toTeamId || onAutoTeam(team) || team.managerEmail === undefined ? [] : [team.managerEmail],
  );
}

/** Who reviews the trade under the league's rules, or null for nobody: the commissioner under a
 *  veto, the co-commissioner when he is in it, or a vote when there is none (or the
 *  co-commissioner is in it too). */
async function reviewerOf(ctx: QueryCtx, league: Doc<"leagues">, offer: Doc<"tradeOffers">): Promise<ReviewWords | null> {
  const rules = await latestRules(ctx, league._id);
  const review = rules === null ? "none" : tradeRulesOf(rules).review;
  if (review !== "veto") return review === "vote" ? { kind: "vote" } : null;
  const inIt = new Set(await managersOf(ctx, offer));
  const by = [league.commissionerEmail, league.coCommissionerEmail].find((email) => email !== undefined && !inIt.has(email));
  return by === undefined ? { kind: "vote" } : { kind: "veto", by };
}

/** The accepted offer goes into review, or through at once with none. */
export async function startReview(ctx: MutationCtx, offer: Doc<"tradeOffers">, acceptedBy: string): Promise<void> {
  const league = await leagueOf(ctx, offer.leagueId);
  const review = await reviewerOf(ctx, league, offer);
  if (review === null) {
    await goThrough(ctx, offer, acceptedBy, true);
    return;
  }
  const endsAt = Date.now() + REVIEW_MS;
  const scheduledId = await ctx.scheduler.runAt(endsAt, internal.trades.tradeReview.finish, { offerId: offer._id });
  const reviewer = review.kind === "veto" ? review : { kind: "vote" as const, against: [] };
  await ctx.db.patch("tradeOffers", offer._id, { review: { acceptedBy, endsAt, scheduledId, reviewer } });
  const words = await tradeWordsOf(ctx, offer);
  await fileLetter(ctx, league, await managersOf(ctx, offer), (zone) => acceptedLetter(words, review, endsAt, zone), acceptedBy);
  const reviewers = review.kind === "veto" ? [review.by] : await votersOn(ctx, offer);
  await fileLetter(ctx, league, reviewers, (zone) => reviewLetter(words, review, endsAt, zone));
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

/** Makes the trade: its players move at once, the league gets the usual trade letter, each team's
 *  first lineup is picked again, and any other open offer holding one of them closes. If a player
 *  has left his side's team meanwhile, nobody moves and both managers are told. The letter is
 *  filed read for `by` only when `watched`: accepted with no review, not at a review's end. */
async function goThrough(ctx: MutationCtx, offer: Doc<"tradeOffers">, by: string, watched: boolean): Promise<void> {
  const league = await leagueOf(ctx, offer.leagueId);
  const words = await tradeWordsOf(ctx, offer);
  await ctx.db.delete("tradeOffers", offer._id);
  const gone = await playerGone(ctx, offer);
  if (gone !== null) {
    const team = await ctx.db.get("teams", gone.teamId);
    await fileLetter(ctx, league, await managersOf(ctx, offer), tradeFailedLetter(words, await tradedName(ctx, gone.playerCode), team?.name ?? "his team"));
    return;
  }
  const warnings = await tradeWarnings(ctx, league._id, offer);
  const [from, to] = await Promise.all([ctx.db.get("teams", offer.fromTeamId), ctx.db.get("teams", offer.toTeamId)]);
  if (from === null || to === null) throw new Error(`Trade offer ${offer._id} is between teams that no longer exist`);
  const moves = [
    ...offer.gives.map((playerCode) => ({ playerCode, out: from, into: to })),
    ...offer.gets.map((playerCode) => ({ playerCode, out: to, into: from })),
  ];
  for (const { playerCode, out, into } of moves) {
    const place = await placeOf(ctx, league._id, playerCode);
    if (place === null) throw new Error(`Player ${playerCode} left his squad while his trade was made`);
    // A new team starts him afresh, on no number of its own (spec/05 Squad numbers), as a move does.
    await ctx.db.patch("squadPlayers", place._id, { teamId: into._id, number: undefined });
    await fileEvent(ctx, league._id, by, {
      kind: "playerMoved",
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
  await ctx.db.delete("tradeOffers", offer._id);
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

/** Under a vote, a manager of another team still playing votes against the trade. */
export const against = mutation({
  args: { leagueId: v.id("leagues"), offerId: v.id("tradeOffers") },
  returns: v.null(),
  handler: async (ctx, { leagueId, offerId }) => {
    const { email } = await managerOf(ctx, leagueId);
    const offer = await inReview(ctx, leagueId, offerId);
    const { reviewer } = offer.review;
    if (reviewer.kind !== "vote" || !(await votersOn(ctx, offer)).includes(email)) refuse(reviewRefusals.notYourVote);
    if (reviewer.against.includes(email)) refuse(reviewRefusals.votedAlready);
    await ctx.db.patch("tradeOffers", offer._id, { review: { ...offer.review, reviewer: { ...reviewer, against: [...reviewer.against, email] } } });
    return null;
  },
});

/** Whether most of the managers still playing voted against the trade: more than half of those
 *  who may vote now, counting only their votes. */
export function mostAgainst(voters: readonly string[], against: readonly string[]): boolean {
  const counted = against.filter((email) => voters.includes(email)).length;
  return counted * 2 > voters.length;
}

/** The review's 24 hours are up: blocked if most voted against, through otherwise. A trade already
 *  blocked, or a league since deleted, leaves no offer, and nothing happens. */
export const finish = internalMutation({
  args: { offerId: v.id("tradeOffers") },
  returns: v.null(),
  handler: async (ctx, { offerId }) => {
    const offer = await ctx.db.get("tradeOffers", offerId);
    if (offer === null || offer.review === undefined) return null;
    const { reviewer, acceptedBy } = offer.review;
    if (reviewer.kind === "vote" && mostAgainst(await votersOn(ctx, offer), reviewer.against)) {
      await blockTrade(ctx, offer, { kind: "vote" });
      return null;
    }
    await goThrough(ctx, offer, acceptedBy, false);
    return null;
  },
});
