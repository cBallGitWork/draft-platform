import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { fileLetter } from "../mail/letters";
import { offerLetter } from "../mail/tradeLetterWords";
import { namedPlayer, tradePick } from "../schema";
import { leagueOpens } from "../leagues/leagueOpens";
import { managerOf, refuse, refusals, signedInEmail, teamIn, teamOf } from "../shared/leagueAccess";
import { playerByCode } from "../shared/players";
import { placeOf } from "../squads/squadPlace";
import { squadWarning } from "../squads/squads";
import { closeOffer, deadlinePassed, endOffer, heldInReview, leagueOffers } from "./tradeClose";
import { tradedName, tradeWordsOf } from "./tradeWords";
import { startReview } from "./tradeReview";
import { tradeWarnings } from "./tradeSquads";
import { NOTE_MOST, OFFERS_PER_TEAM_MOST } from "./tradeLimits";
import { checkPicks, checkPicksFree, samePick, type TradePicks } from "./tradePicks";
import { onAutoTeam } from "../lineup/autoTeam";
import { offerCloses, tradeDeadlineInForce, tradesShut } from "./tradeShut";
import { shutWords } from "./tradeShutWords";

// A trade's offer (spec/08 Trades; #383): a manager offers another any mix of players on either
// side, in any numbers, with a one-line note. The other manager accepts, rejects or counters with
// a changed offer, which closes the old one; the manager who made it can withdraw it until it is
// accepted (Craig, 6 Nov 2026). Accepted, it goes into review or straight through
// (tradeReview.ts). Both managers get a Mail letter at each step. Before the draft starts, an
// offer can instead be one draft pick each way and nothing else (tradePicks.ts; #1096).

export const offerRefusals = {
  ...shutWords,
  autoTeam: (teamName: string) => `${teamName} is on the auto team, so it can't trade.`,
  sameTeam: "A trade is between two teams.",
  noPlayers: "Put at least one player in the trade.",
  twice: "A player is in the trade twice.",
  notOnTeam: (playerName: string, teamName: string) => `${playerName} isn't in ${teamName}'s squad.`,
  noteTooLong: `A note is up to ${NOTE_MOST} characters.`,
  noteOneLine: "A note is one line.",
  notYours: "That offer isn't to you.",
  notYoursToWithdraw: "That offer isn't one you made.",
  closed: "That offer is closed.",
  held: (playerName: string) => `${playerName} is in another trade under review.`,
  alreadyOffered: (teamName: string) => `You've already offered ${teamName} this trade.`,
  tooMany: `You have ${OFFERS_PER_TEAM_MOST} offers open, the most a team can: withdraw one before making another.`,
};

const teamWarnings = v.array(v.object({ teamId: v.id("teams"), teamName: v.string(), warnings: v.array(squadWarning) }));

const offerArgs = {
  leagueId: v.id("leagues"),
  gives: v.array(v.number()),
  gets: v.array(v.number()),
  /** A pick trade's picks, one each way (tradePicks.ts), with `gives` and `gets` empty. */
  picks: v.optional(v.object({ gives: tradePick, gets: tradePick })),
  note: v.union(v.string(), v.null()),
};

type OfferTerms = { gives: number[]; gets: number[]; picks?: TradePicks; note: string | null };

/** The note as kept: trimmed, absent when blank. */
function keptNote(note: string | null): string | undefined {
  const trimmed = note?.trim() ?? "";
  if (/[\r\n]/.test(trimmed)) refuse(offerRefusals.noteOneLine);
  if (trimmed.length > NOTE_MOST) refuse(offerRefusals.noteTooLong);
  return trimmed === "" ? undefined : trimmed;
}

/** Refuses a trade while trades are shut, or between teams that can't trade. */
async function checkOpen(ctx: QueryCtx, league: Doc<"leagues">, teams: readonly Doc<"teams">[], now: number) {
  const shut = await tradesShut(ctx, league, await leagueDeadlines(ctx, league._id), now);
  if (shut !== null) refuse(offerRefusals[shut]);
  for (const team of teams) if (onAutoTeam(team)) refuse(offerRefusals.autoTeam(team.name));
}

/** Refuses players not each on his side's team, once each. */
async function checkPlayers(ctx: QueryCtx, leagueId: Id<"leagues">, sides: readonly { team: Doc<"teams">; codes: readonly number[] }[]) {
  const codes = sides.flatMap((side) => side.codes);
  if (codes.length === 0) refuse(offerRefusals.noPlayers);
  if (new Set(codes).size !== codes.length) refuse(offerRefusals.twice);
  for (const { team, codes } of sides) {
    for (const code of codes) {
      const player = (await playerByCode(ctx, code)) ?? refuse(refusals.noPlayer);
      if ((await placeOf(ctx, leagueId, code))?.teamId !== team._id) refuse(offerRefusals.notOnTeam(player.name, team.name));
    }
  }
}

/** Refuses what each side gives unless it is players each on his side's team, or one pick each way
 *  and nothing else (tradePicks.ts). */
async function checkSides(ctx: QueryCtx, leagueId: Id<"leagues">, from: Doc<"teams">, to: Doc<"teams">, { gives, gets, picks }: Omit<OfferTerms, "note">) {
  if (picks !== undefined) {
    await checkPicks(ctx, leagueId, picks, { from, to, players: gives.length + gets.length });
    return;
  }
  await checkPlayers(ctx, leagueId, [
    { team: from, codes: gives },
    { team: to, codes: gets },
  ]);
}

/** Whether the held offer is the same trade between the same teams: the same players each way, in
 *  any order, and the same picks, whatever its note (#1539). */
function sameTrade(held: Doc<"tradeOffers">, from: Id<"teams">, to: Id<"teams">, { gives, gets, picks }: Omit<OfferTerms, "note">): boolean {
  const samePlayers = (one: readonly number[], other: readonly number[]) => one.length === other.length && one.every((code) => other.includes(code));
  const samePicks = held.picks === undefined || picks === undefined ? held.picks === picks : samePick(held.picks.gives, picks.gives) && samePick(held.picks.gets, picks.gets);
  return held.fromTeamId === from && held.toTeamId === to && samePlayers(held.gives, gives) && samePlayers(held.gets, gets) && samePicks;
}

/** Makes an offer from `from` to `to`, with both managers' letter, after every check: refused while
 *  `from` has OFFERS_PER_TEAM_MOST open, unanswered and no deadline since (Craig, 11 Nov 2026, #1609). */
async function makeOffer(
  ctx: MutationCtx,
  league: Doc<"leagues">,
  by: string,
  from: Doc<"teams">,
  to: Doc<"teams">,
  { gives, gets, picks, note }: OfferTerms,
  countered: boolean,
) {
  if (from._id === to._id) refuse(offerRefusals.sameTeam);
  const now = Date.now();
  await checkOpen(ctx, league, [from, to], now);
  await checkSides(ctx, league._id, from, to, { gives, gets, picks });
  const held = await leagueOffers(ctx, league._id);
  if (held.some((offer) => sameTrade(offer, from._id, to._id, { gives, gets, picks }))) refuse(offerRefusals.alreadyOffered(to.name));
  const deadlines = await leagueDeadlines(ctx, league._id);
  const open = held.filter((offer) => offer.fromTeamId === from._id && offer.review === undefined && !deadlinePassed(offer, deadlines, now));
  if (open.length >= OFFERS_PER_TEAM_MOST) refuse(offerRefusals.tooMany);
  const kept = keptNote(note);
  const offer = {
    leagueId: league._id,
    fromTeamId: from._id,
    toTeamId: to._id,
    gives,
    gets,
    ...(picks === undefined ? {} : { picks }),
    by,
    madeAt: now,
    ...(kept === undefined ? {} : { note: kept }),
  };
  const warnings = await tradeWarnings(ctx, league._id, offer);
  const offerId = await ctx.db.insert("tradeOffers", offer);
  const words = await tradeWordsOf(ctx, offer);
  const closes = offerCloses(deadlines, now, await tradeDeadlineInForce(ctx, league._id, deadlines, now));
  const lastMatchOf = closes !== null && closes.at === null ? closes.gameweek : null;
  await fileLetter(ctx, league, [to.managerEmail, by].filter((email) => email !== undefined), offerLetter(words, by, countered, lastMatchOf), by);
  return { offerId, warnings };
}

/** The manager offers another team a trade: `gives` from his squad for `gets` from theirs, with a
 *  note. Its id, and the squad limits each squad would break once it is made, which warn only. */
export const offer = mutation({
  args: { ...offerArgs, toTeamId: v.id("teams") },
  returns: v.object({ offerId: v.id("tradeOffers"), warnings: teamWarnings }),
  handler: async (ctx, { leagueId, toTeamId, ...terms }) => {
    const { email, league, team } = await managerOf(ctx, leagueId);
    const to = await teamIn(ctx, leagueId, toTeamId);
    return makeOffer(ctx, league, email, team, to, terms, false);
  },
});

/** The open offer, refused unless it is, and closed (and refused) once a deadline has passed since
 *  it was made. */
async function openOffer(ctx: QueryCtx, leagueId: Id<"leagues">, offerId: Id<"tradeOffers">) {
  const offer = await ctx.db.get("tradeOffers", offerId);
  if (offer === null || offer.leagueId !== leagueId || offer.review !== undefined) refuse(offerRefusals.closed);
  if (deadlinePassed(offer, await leagueDeadlines(ctx, leagueId), Date.now())) refuse(offerRefusals.closed);
  return offer;
}

/** The open offer to the caller's team. */
async function offerToMe(ctx: QueryCtx, leagueId: Id<"leagues">, offerId: Id<"tradeOffers">) {
  const { email, league, team } = await managerOf(ctx, leagueId);
  const offer = await openOffer(ctx, leagueId, offerId);
  if (offer.toTeamId !== team._id) refuse(offerRefusals.notYours);
  return { email, league, team, offer };
}

/** The other manager accepts the offer: into review, or through at once with none. The squad
 *  limits each squad would break once it is made, which warn only. */
export const accept = mutation({
  args: { leagueId: v.id("leagues"), offerId: v.id("tradeOffers") },
  returns: teamWarnings,
  handler: async (ctx, { leagueId, offerId }) => {
    const { email, league, team, offer } = await offerToMe(ctx, leagueId, offerId);
    const from = await teamIn(ctx, leagueId, offer.fromTeamId);
    await checkOpen(ctx, league, [from, team], Date.now());
    await checkSides(ctx, leagueId, from, team, offer);
    await checkPicksFree(ctx, offer);
    const held = await heldInReview(ctx, leagueId);
    for (const code of [...offer.gives, ...offer.gets]) {
      if (held.has(code)) {
        refuse(offerRefusals.held(await tradedName(ctx, code)));
      }
    }
    const warnings = await tradeWarnings(ctx, leagueId, offer);
    await startReview(ctx, offer, email);
    return warnings;
  },
});

/** The other manager rejects the offer, which closes. */
export const reject = mutation({
  args: { leagueId: v.id("leagues"), offerId: v.id("tradeOffers") },
  returns: v.null(),
  handler: async (ctx, { leagueId, offerId }) => {
    const { email, offer } = await offerToMe(ctx, leagueId, offerId);
    await closeOffer(ctx, offer, { why: "rejected" }, email);
    return null;
  },
});

/** The other manager counters with a changed offer from his team, which closes the old one. Its
 *  id, and the warnings as `offer` gives them. */
export const counter = mutation({
  args: { ...offerArgs, offerId: v.id("tradeOffers") },
  returns: v.object({ offerId: v.id("tradeOffers"), warnings: teamWarnings }),
  handler: async (ctx, { leagueId, offerId, ...terms }) => {
    const { email, league, team, offer } = await offerToMe(ctx, leagueId, offerId);
    const to = await teamIn(ctx, leagueId, offer.fromTeamId);
    await endOffer(ctx, offer, "countered");
    return makeOffer(ctx, league, email, team, to, terms, true);
  },
});

/** The manager who made the offer withdraws it before it is accepted (Craig, 6 Nov 2026). */
export const withdraw = mutation({
  args: { leagueId: v.id("leagues"), offerId: v.id("tradeOffers") },
  returns: v.null(),
  handler: async (ctx, { leagueId, offerId }) => {
    const { email, team } = await managerOf(ctx, leagueId);
    const offer = await openOffer(ctx, leagueId, offerId);
    if (offer.fromTeamId !== team._id) refuse(offerRefusals.notYoursToWithdraw);
    await closeOffer(ctx, offer, { why: "withdrawn" }, email);
    return null;
  },
});

const shownOffer = v.object({
  offerId: v.id("tradeOffers"),
  fromTeamId: v.id("teams"),
  fromTeamName: v.string(),
  toTeamId: v.id("teams"),
  toTeamName: v.string(),
  gives: v.array(namedPlayer),
  gets: v.array(namedPlayer),
  /** A pick trade's picks, each named as its letters name it; null for a players' trade. */
  picks: v.union(v.object({ gives: v.object({ ...tradePick.fields, name: v.string() }), gets: v.object({ ...tradePick.fields, name: v.string() }) }), v.null()),
  note: v.union(v.string(), v.null()),
  madeAt: v.number(),
  /** Null while it is open; once accepted, how it is reviewed and when the review ends. */
  review: v.union(v.object({ kind: v.union(v.literal("veto"), v.literal("vote")), endsAt: v.number() }), v.null()),
});

/** The offers to and from the caller's team, open or in review, oldest first. */
export const mine = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(shownOffer),
  handler: async (ctx, { leagueId }) => {
    const { team } = await managerOf(ctx, leagueId);
    const offers = (await leagueOffers(ctx, leagueId)).filter((offer) => offer.fromTeamId === team._id || offer.toTeamId === team._id);
    return Promise.all(
      offers.map(async (offer) => {
        const words = await tradeWordsOf(ctx, offer);
        const named = (codes: number[], names: readonly string[]) => codes.map((playerCode, index) => ({ playerCode, playerName: names[index] }));
        return {
          offerId: offer._id,
          fromTeamId: offer.fromTeamId,
          fromTeamName: words.fromTeamName,
          toTeamId: offer.toTeamId,
          toTeamName: words.toTeamName,
          gives: named(offer.gives, words.gives),
          gets: named(offer.gets, words.gets),
          picks: offer.picks === undefined ? null : { gives: { ...offer.picks.gives, name: words.gives[0] }, gets: { ...offer.picks.gets, name: words.gets[0] } },
          note: words.note,
          madeAt: offer.madeAt,
          review: offer.review === undefined ? null : { kind: offer.review.reviewer.kind, endsAt: offer.review.endsAt },
        };
      }),
    );
  },
});

/** How many open offers wait for the caller's answer, made to his team and not yet accepted, for
 *  Continue (spec/12; #1553); none for anyone who runs no team there, or a league that doesn't open. */
export const countWaitingForMe = query({
  args: { leagueId: v.id("leagues") },
  returns: v.number(),
  handler: async (ctx, { leagueId }) => {
    const email = await signedInEmail(ctx);
    const league = await ctx.db.get("leagues", leagueId);
    const team = email === null || league === null || !leagueOpens(league) ? undefined : await teamOf(ctx, leagueId, email);
    if (team === undefined) return 0;
    return (await leagueOffers(ctx, leagueId)).filter((offer) => offer.toTeamId === team._id && offer.review === undefined).length;
  },
});
