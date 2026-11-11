import { v, type Infer } from "convex/values";
import type { closedWhy } from "../schema";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { scheduleHeartbeat } from "../heartbeats/heartbeat";
import { fileLetter } from "../mail/letters";
import { offerClosedLetter, type OfferClosed } from "../mail/tradeLetterWords";
import { scheduleEveryLeague, takeAllOrThrow } from "../shared/cappedRead";
import type { LeagueDeadlines } from "../gameweeks/deadline";
import { MOST_TEAMS } from "../leagues/leagueLimits";
import { teamIn } from "../shared/leagueAccess";
import { OFFERS_PER_TEAM_MOST } from "./tradeLimits";
import { deadlinePassedSince } from "../waivers/waiverLock";
import { onAutoTeam, tradesShut } from "./tradeShut";
import type { TradesShut } from "./tradeShutWords";
import { leagueOf, managersOf, tradedName, tradeWordsOf } from "./tradeWords";

// Closing trade offers (spec/08 Trades; #383). An open offer closes, with a letter to both
// managers saying why, when it is withdrawn, rejected or countered; at the next deadline if nobody
// answers it; when the trade deadline passes or a break starts; when either team goes on the auto
// team; and the moment one of its players leaves his squad, by a drop, a claim, a pickup, the
// commissioner or another trade (Craig, 6 Nov 2026). A trade already accepted and in review isn't
// closed by any of these: it finishes its review (tradeReview.ts). Its players are held meanwhile:
// they can't be dropped, and an accepted trade can't take them. Nothing closes while the league is
// frozen for deletion; an offer due meanwhile closes at the cron's first check after an undo (#1493).

/** How often the cron closes the offers whose deadline has passed: Claude's choice, so an offer
 *  closes at most this late, and is refused as closed meanwhile. */
export const OFFER_CHECK_EVERY = { minutes: 5 } as const;

/** The most offers open or in review that one read of a league's takes: every team at its ceiling
 *  of open offers (#1609), and as many again for those in review or waiting on the cron after a
 *  deadline, so drops, pickups, trades and the waiver run never meet it. Past it a read throws
 *  rather than leave offers out. */
export const OFFERS_READ_MOST = 2 * MOST_TEAMS * OFFERS_PER_TEAM_MOST;

/** Every offer open or in review in the league. */
export function leagueOffers(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"tradeOffers">[]> {
  return takeAllOrThrow(
    ctx.db.query("tradeOffers").withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId)),
    OFFERS_READ_MOST,
    `League ${leagueId} has more than ${OFFERS_READ_MOST} trade offers, so they can't all be read`,
  );
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
  const { name: teamName } = await teamIn(ctx, leagueId, teamId);
  for (const offer of await leagueOffers(ctx, leagueId)) {
    if (offer.review !== undefined) continue;
    const gone = [...offer.gives, ...offer.gets].find((code) => left.has(code));
    if (gone === undefined) continue;
    await closeOffer(ctx, offer, { why: "playerLeft", playerName: await tradedName(ctx, gone), teamName });
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

/** The players, by code, in a trade in review in the league: each is held until it finishes. Read
 *  once and checked per player, so the league's offers aren't read again for each (#1539). */
export async function heldInReview(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Set<number>> {
  const offers = await leagueOffers(ctx, leagueId);
  return new Set(offers.flatMap((offer) => (offer.review === undefined ? [] : [...offer.gives, ...offer.gets])));
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

/** A league frozen for deletion closes nothing: its offers due wait for an undo (#1493). */
const closesOffers = (league: Doc<"leagues">) => league.deletion === undefined;

/** The cron's: asks each league holding an offer to close those whose time is up, each league in
 *  its own transaction (#1558), so the offers cap is each league's, never the platform's (#1539),
 *  and an offer one league can't close never holds up another's. */
export const closeDue = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await scheduleEveryLeague(
      ctx,
      internal.trades.tradeClose.closeLeagueDue,
      "so their trade offers due can't all be closed",
      async (league) =>
        closesOffers(league) && (await ctx.db.query("tradeOffers").withIndex("by_leagueId", (q) => q.eq("leagueId", league._id)).first()) !== null,
    );
    await scheduleHeartbeat(ctx, "tradeOffers");
    return null;
  },
});

/** Closes each open offer of the league whose time is up, as `closeDue` asks; a league gone or
 *  frozen since closes nothing. */
export const closeLeagueDue = internalMutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const league = await ctx.db.get("leagues", leagueId);
    if (league === null || !closesOffers(league)) return null;
    const open = (await leagueOffers(ctx, leagueId)).filter((offer) => offer.review === undefined);
    if (open.length === 0) return null;
    const now = Date.now();
    const deadlines = await leagueDeadlines(ctx, leagueId);
    const shut = await tradesShut(ctx, league, deadlines, now);
    for (const offer of open) {
      const closed = await closingReason(ctx, offer, shut, deadlines, now);
      if (closed !== null) await closeOffer(ctx, offer, closed);
    }
    return null;
  },
});
