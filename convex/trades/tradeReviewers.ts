import type { Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { latestBegun, type LeagueDeadlines } from "../gameweeks/deadline";
import { fileLetter } from "../mail/letters";
import { reviewLetter, type ReviewWords } from "../mail/tradeLetterWords";
import { tradeRulesOf } from "../rules/firstRules";
import type { TradeRules } from "../rules/leagueRulesShape";
import { rulesSinceBegun } from "../rules/rulesHistory";
import type { tradeReviewer } from "../schema/trades";
import { teamsOf } from "../shared/leagueAccess";
import { leagueOffers } from "./tradeClose";
import { leagueOf, managersOf, tradeWordsOf } from "./tradeWords";
import { onAutoTeam } from "../lineup/autoTeam";

// Who reviews an accepted trade (spec/08 Trades; #383): under a commissioner veto, the
// commissioner, or the co-commissioner when he is in it, or a league vote when there is none;
// under a vote, the managers of the other teams still playing. A veto follows the role, not the
// person: a change of commissioner or co-commissioner passes the trade on (#1472). Each read has a
// pure half, so a screen reads the rules and the teams once for all its offers.

/** The two teams a trade is between. */
type TradeTeams = Pick<Doc<"tradeOffers">, "fromTeamId" | "toTeamId">;

/** The managers among the league's `teams` who vote on a trade: those of the other teams, but not
 *  one on the auto team. Pure. */
export function votersAmong(teams: readonly Doc<"teams">[], offer: TradeTeams): string[] {
  return teams.flatMap((team) =>
    team._id === offer.fromTeamId || team._id === offer.toTeamId || onAutoTeam(team) || team.managerEmail === undefined ? [] : [team.managerEmail],
  );
}

/** The managers who vote on a trade, read from the league's teams. */
export async function votersOn(ctx: QueryCtx, offer: Doc<"tradeOffers">): Promise<string[]> {
  return votersAmong(await teamsOf(ctx, offer.leagueId), offer);
}

/** The managers of a trade's two teams, among the league's `teams`. Pure. */
export function managersAmong(teams: readonly Doc<"teams">[], offer: TradeTeams): string[] {
  return teams.flatMap((team) =>
    (team._id === offer.fromTeamId || team._id === offer.toTeamId) && team.managerEmail !== undefined ? [team.managerEmail] : [],
  );
}

/** The league's trade rules in force at `now`, not a change waiting for the next gameweek (#1473). */
export async function tradeRulesAt(ctx: QueryCtx, leagueId: Id<"leagues">, deadlines: LeagueDeadlines, now: number): Promise<TradeRules> {
  return tradeRulesOf(await rulesSinceBegun(ctx, leagueId, latestBegun(deadlines, now)));
}

/** Who reviews the trade under the league's rules in force at `now`, or null for nobody
 *  (`reviewUnder`). */
export async function reviewerOf(ctx: QueryCtx, league: Doc<"leagues">, offer: Doc<"tradeOffers">, deadlines: LeagueDeadlines, now: number): Promise<ReviewWords | null> {
  const { review } = await tradeRulesAt(ctx, league._id, deadlines, now);
  return reviewUnder(review, league, review === "veto" ? await managersOf(ctx, offer) : []);
}

/** Who reviews a trade under the `review` rule, with `managersInIt` its two teams' managers, or null
 *  for nobody: the commissioner under a veto, the co-commissioner when he is in it, or a vote when
 *  there is none (or the co-commissioner is in it too). Pure. */
export function reviewUnder(review: TradeRules["review"], league: Doc<"leagues">, managersInIt: readonly string[]): ReviewWords | null {
  if (review !== "veto") return review === "vote" ? { kind: "vote" } : null;
  return reviewOf(vetoerAmong(league, managersInIt));
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
function vetoerAmong(league: Doc<"leagues">, managersInIt: readonly string[]): string | undefined {
  return [league.commissionerEmail, league.coCommissionerEmail].find((email) => email !== undefined && !managersInIt.includes(email));
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
    const by = vetoerAmong(league, await managersOf(ctx, offer));
    if (by === review.reviewer.by) continue;
    const now = reviewOf(by);
    await ctx.db.patch("tradeOffers", offer._id, { review: { ...review, reviewer: storedReviewer(now) } });
    const words = await tradeWordsOf(ctx, offer);
    await fileLetter(ctx, league, await reviewersOf(ctx, offer, now), (tell) => reviewLetter(words, now, review.endsAt, tell));
  }
}
