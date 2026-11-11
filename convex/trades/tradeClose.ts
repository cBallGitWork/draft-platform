import { v, type Infer } from "convex/values";
import type { closedWhy } from "../schema/trades";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { scheduleHeartbeat } from "../heartbeats/heartbeat";
import { fileLetter } from "../mail/letters";
import { offerClosedLetter, pickWords, type OfferClosed, type TradeWords } from "../mail/tradeLetterWords";
import type { TradePick } from "./tradePicks";
import { takeAllOrThrow } from "../shared/cappedRead";
import type { LeagueDeadlines } from "../gameweeks/deadline";
import { groupedBy } from "../shared/groupedBy";
import { heldPlayerByCode } from "../shared/players";
import { deadlinePassedSince } from "../waivers/waiverLock";
import { onAutoTeam, tradesShut, type TradesShut } from "./tradeShut";

// Closing trade offers (spec/08 Trades; #383). An open offer closes, with a letter to both
// managers saying why, when it is withdrawn, rejected or countered; at the next deadline if nobody
// answers it; when the trade deadline passes or a break starts; when either team goes on the auto
// team; and the moment one of its players leaves his squad, by a drop, a claim, a pickup, the
// commissioner or another trade (Craig, 6 Nov 2026). A trade already accepted and in review isn't
// closed by any of these: it finishes its review (tradeReview.ts). Its players are held meanwhile:
// they can't be dropped, and an accepted trade can't take them.

/** How often the cron closes the offers whose deadline has passed: Claude's choice, so an offer
 *  closes at most this late, and is refused as closed meanwhile. */
export const OFFER_CHECK_EVERY = { minutes: 5 } as const;

/** The most offers open or in review that one read takes, in a league or across all of them:
 *  Claude's sizing. Past it a read throws rather than leave offers out. */
export const OFFERS_READ_MOST = 1000;

/** Every offer open or in review in the league. */
export function leagueOffers(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"tradeOffers">[]> {
  return takeAllOrThrow(
    ctx.db.query("tradeOffers").withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId)),
    OFFERS_READ_MOST,
    `League ${leagueId} has more than ${OFFERS_READ_MOST} trade offers, so they can't all be read`,
  );
}

/** The log line for an offer naming a player the football sync doesn't hold. */
export const unheldTradedWords = (playerCode: number) => `A trade offer names player ${playerCode}, whom the football sync doesn't hold`;

/** A player's name, as a trade's letters name him: an offer names only players the football sync
 *  holds, and it never deletes one. */
export async function tradedName(ctx: QueryCtx, playerCode: number): Promise<string> {
  return (await heldPlayerByCode(ctx, playerCode, unheldTradedWords(playerCode))).name;
}

/** A trade as its letters read it: an offer, or a pick trade that went through (tradePicks.ts). */
type TradeTerms = Pick<Doc<"tradeOffers">, "fromTeamId" | "toTeamId" | "gives" | "gets" | "picks" | "note">;

/** The offer as its letters name it. */
export async function tradeWordsOf(ctx: QueryCtx, offer: TradeTerms): Promise<TradeWords> {
  const [from, to] = await Promise.all([ctx.db.get("teams", offer.fromTeamId), ctx.db.get("teams", offer.toTeamId)]);
  if (from === null || to === null) throw new Error(`A trade between teams ${offer.fromTeamId} and ${offer.toTeamId} names a team that no longer exists`);
  const { picks } = offer;
  if (picks !== undefined) {
    const [gives, gets] = await Promise.all([pickName(ctx, picks.gives), pickName(ctx, picks.gets)]);
    return { fromTeamName: from.name, toTeamName: to.name, gives: [gives], gets: [gets], note: offer.note ?? null };
  }
  return {
    fromTeamName: from.name,
    toTeamName: to.name,
    gives: await Promise.all(offer.gives.map((code) => tradedName(ctx, code))),
    gets: await Promise.all(offer.gets.map((code) => tradedName(ctx, code))),
    note: offer.note ?? null,
  };
}

/** A draft pick in a trade (#1096), as its letters name it: by the team whose pick it is. */
export async function pickName(ctx: QueryCtx, pick: TradePick): Promise<string> {
  const team = await ctx.db.get("teams", pick.teamId);
  if (team === null) throw new Error(`A trade offer names a pick of team ${pick.teamId}, which no longer exists`);
  return pickWords(pick.round, team.name);
}

/** Both teams' managers, by email: those a trade's own letters go to. */
export async function managersOf(ctx: QueryCtx, offer: Pick<TradeTerms, "fromTeamId" | "toTeamId">): Promise<string[]> {
  const teams = await Promise.all([ctx.db.get("teams", offer.fromTeamId), ctx.db.get("teams", offer.toTeamId)]);
  return teams.flatMap((team) => team?.managerEmail ?? []);
}

/** The league, which a trade's letters are filed in the name of. */
export async function leagueOf(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"leagues">> {
  const league = await ctx.db.get("leagues", leagueId);
  if (league === null) throw new Error(`League ${leagueId} doesn't exist, so its trade letters can't be filed`);
  return league;
}

/** Ends an offer that didn't go through: it leaves the open offers and is kept, with why, for the
 *  Trades screen's Closed offers. Its letters are the caller's. */
export async function endOffer(ctx: MutationCtx, offer: Doc<"tradeOffers">, why: Infer<typeof closedWhy>): Promise<void> {
  await ctx.db.delete("tradeOffers", offer._id);
  const { leagueId, fromTeamId, toTeamId, gives, gets, picks, note, by, madeAt } = offer;
  await ctx.db.insert("closedTradeOffers", {
    leagueId,
    fromTeamId,
    toTeamId,
    gives,
    gets,
    ...(picks === undefined ? {} : { picks }),
    ...(note === undefined ? {} : { note }),
    by,
    madeAt,
    closedAt: Date.now(),
    why,
  });
}

/** Closes an open offer, telling both managers why: the copy to `by`, who closed it, filed read. */
export async function closeOffer(ctx: MutationCtx, offer: Doc<"tradeOffers">, closed: OfferClosed, by?: string): Promise<void> {
  const words = await tradeWordsOf(ctx, offer);
  await endOffer(ctx, offer, closed.why);
  await fileLetter(ctx, await leagueOf(ctx, offer.leagueId), await managersOf(ctx, offer), offerClosedLetter(words, closed), by);
}

/** Whether a deadline of the league's has passed since the offer was made: unanswered, it is closed. */
export const deadlinePassed = (offer: Doc<"tradeOffers">, deadlines: LeagueDeadlines, now: number) =>
  deadlinePassedSince(deadlines, offer.madeAt, now);

/** Closes each open offer holding a player who just left `teamId`'s squad. */
export async function closeOffersHolding(ctx: MutationCtx, leagueId: Id<"leagues">, teamId: Id<"teams">, playerCodes: readonly number[]): Promise<void> {
  const left = new Set(playerCodes);
  for (const offer of await leagueOffers(ctx, leagueId)) {
    if (offer.review !== undefined) continue;
    const gone = [...offer.gives, ...offer.gets].find((code) => left.has(code));
    if (gone === undefined) continue;
    const team = await ctx.db.get("teams", teamId);
    await closeOffer(ctx, offer, { why: "playerLeft", playerName: await tradedName(ctx, gone), teamName: team?.name ?? "his team" });
  }
}

/** Closes each open offer to or from the team, which just went on the auto team. */
export async function closeOffersOfTeam(ctx: MutationCtx, team: Doc<"teams">): Promise<void> {
  for (const offer of await leagueOffers(ctx, team.leagueId)) {
    if (offer.review === undefined && (offer.fromTeamId === team._id || offer.toTeamId === team._id)) {
      await closeOffer(ctx, offer, { why: "autoTeam", teamName: team.name });
    }
  }
}

/** The trade in review holding the player, if one is: he is held until it finishes. */
export async function reviewHolding(ctx: QueryCtx, leagueId: Id<"leagues">, playerCode: number): Promise<Doc<"tradeOffers"> | null> {
  const offers = await leagueOffers(ctx, leagueId);
  return offers.find((offer) => offer.review !== undefined && [...offer.gives, ...offer.gets].includes(playerCode)) ?? null;
}

/** Why an open offer should be closed at `now`, if it should: the deadline has passed since it was
 *  made, the trade deadline has passed, a break has started, or a team in it is on the auto team. */
async function closingReason(
  ctx: QueryCtx,
  offer: Doc<"tradeOffers">,
  shut: TradesShut,
  deadlines: LeagueDeadlines,
  now: number,
): Promise<OfferClosed | null> {
  if (shut === "tradeDeadline" || shut === "unusedGameweek") return { why: shut };
  if (deadlinePassed(offer, deadlines, now)) return { why: "deadline" };
  for (const teamId of [offer.fromTeamId, offer.toTeamId]) {
    const team = await ctx.db.get("teams", teamId);
    if (team !== null && onAutoTeam(team)) return { why: "autoTeam", teamName: team.name };
  }
  return null;
}

/** The cron's: closes every open offer whose time is up, league by league. */
export const closeDue = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const offers = await takeAllOrThrow(
      ctx.db.query("tradeOffers").withIndex("by_madeAt"),
      OFFERS_READ_MOST,
      `More than ${OFFERS_READ_MOST} trade offers are held, so those due can't all be closed`,
    );
    const byLeague = groupedBy(
      offers.filter((offer) => offer.review === undefined),
      (offer) => offer.leagueId,
    );
    for (const [leagueId, open] of byLeague) {
      const league = await ctx.db.get("leagues", leagueId);
      if (league === null) continue;
      const deadlines = await leagueDeadlines(ctx, leagueId);
      const shut = await tradesShut(ctx, league, deadlines, now);
      for (const offer of open) {
        const closed = await closingReason(ctx, offer, shut, deadlines, now);
        if (closed !== null) await closeOffer(ctx, offer, closed);
      }
    }
    await scheduleHeartbeat(ctx, "tradeOffers");
    return null;
  },
});
