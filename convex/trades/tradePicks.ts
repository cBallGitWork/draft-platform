import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { draftHasStarted, draftOf } from "../draft/draftRow";
import { roundsOf } from "../draft/draftRules";
import { pickOwner, type TradedPick } from "../draft/snakeOrder";
import { fileLetter } from "../mail/letters";
import { pickTradeUndoneLetter } from "../mail/tradeLetterWords";
import { latestRules } from "../rules/rulesHistory";
import type { tradePick } from "../schema";
import { refuse, teamIn } from "../shared/leagueAccess";
import { closeOffer, leagueOffers, managersOf, pickName, tradeWordsOf } from "./tradeClose";

// Draft picks in trades (spec/04, The picks; #1096). Picks in the current draft can be traded in
// every league, before the draft starts only (Craig, 2 Nov 2026). A traded pick is a team's pick in
// a round, not a fixed slot: "Just trade '3rd round pick' rather than precise number" (Craig,
// 8 Nov 2026), so it goes wherever that team's turn falls in that round, and the order can still
// change. An offer with a pick in it holds one pick each way and nothing else, and when the draft
// starts, every pick trade still open or in review closes without going through, both managers told
// why (Craig, 8 Nov 2026). The draft row's `tradedPicks` holds who owns each pick that moved, and
// `pickTrades` each trade that moved them. A trade with a pick in a round a squad-size cut removed
// is undone when the draft starts, both managers told in Mail (Craig, 11 Nov 2026, on #1457).

/** A pick in a trade: `teamId`'s pick in `round`, whoever holds it now. */
export type TradePick = Infer<typeof tradePick>;

/** A pick trade's two picks: the one going from the offering team, and the one coming back. */
export type TradePicks = { gives: TradePick; gets: TradePick };

export const pickRefusals = {
  started: "Picks are traded only before the draft starts.",
  pickAndMore: "A trade with a pick in it is one pick for one pick, and nothing else.",
  noRounds: "This league's squads have no size limit, so its draft has no rounds to trade picks in.",
  noRound: (rounds: number) => `The draft has ${rounds} rounds, from 1 to ${rounds}.`,
  notHeld: (pick: string, teamName: string) => `${teamName} doesn't hold ${pick}.`,
  held: (pick: string) => `${pick} is in another trade under review.`,
};

/** The picks that have changed hands in the league's draft, none before any has. */
export async function tradedPicksIn(ctx: QueryCtx, leagueId: Id<"leagues">) {
  return (await draftOf(ctx, leagueId))?.tradedPicks ?? [];
}

/** Whether two picks are one: the same round of the same team's. */
export const samePick = (one: TradePick, other: TradePick) => one.round === other.round && one.teamId === other.teamId;

/** The offer's picks, both of them. */
const picksIn = (offer: Doc<"tradeOffers">): TradePick[] => (offer.picks === undefined ? [] : [offer.picks.gives, offer.picks.gets]);

/** Refuses a pick trade unless it is one pick each way and nothing else, before the draft starts,
 *  each pick a round of the draft held now by its side's team. */
export async function checkPicks(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  picks: TradePicks,
  sides: { from: Doc<"teams">; to: Doc<"teams">; players: number },
): Promise<void> {
  if (sides.players > 0) refuse(pickRefusals.pickAndMore);
  if (await draftHasStarted(ctx, leagueId)) refuse(pickRefusals.started);
  const rounds = roundsOf(await latestRules(ctx, leagueId)) ?? refuse(pickRefusals.noRounds);
  const traded = await tradedPicksIn(ctx, leagueId);
  for (const [pick, holder] of [
    [picks.gives, sides.from],
    [picks.gets, sides.to],
  ] as const) {
    if (!Number.isInteger(pick.round) || pick.round < 1 || pick.round > rounds) refuse(pickRefusals.noRound(rounds));
    await teamIn(ctx, leagueId, pick.teamId);
    if (pickOwner(traded, pick.round, pick.teamId) !== holder._id) refuse(pickRefusals.notHeld(await pickName(ctx, pick), holder.name));
  }
}

/** A pick as the New offer tab offers it: `teamId`'s pick in `round`, `teamName` its team, and
 *  `held` while it is in a trade under review. */
export const tradablePick = v.object({ round: v.number(), teamId: v.id("teams"), teamName: v.string(), held: v.boolean() });
export type TradablePick = Infer<typeof tradablePick>;

/** Who holds each pick of the league's draft now: a team's picks, round by round. None once the
 *  draft has started, or in a league with no rounds. */
export async function pickHolders(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  teams: readonly Doc<"teams">[],
  offers: readonly Doc<"tradeOffers">[],
): Promise<(teamId: Id<"teams">) => TradablePick[]> {
  const rounds = roundsOf(await latestRules(ctx, leagueId));
  if (rounds === null || (await draftHasStarted(ctx, leagueId))) return () => [];
  const traded = await tradedPicksIn(ctx, leagueId);
  const reviewed = offers.filter((offer) => offer.review !== undefined).flatMap(picksIn);
  const all = Array.from({ length: rounds }, (_, index) => index + 1).flatMap((round) =>
    teams.map((team) => ({
      ownerId: pickOwner(traded, round, team._id),
      pick: { round, teamId: team._id, teamName: team.name, held: reviewed.some((each) => samePick(each, { round, teamId: team._id })) },
    })),
  );
  return (teamId) => all.filter(({ ownerId }) => ownerId === teamId).map(({ pick }) => pick);
}

/** Refuses accepting the offer while one of its picks is in another trade under review. */
export async function checkPicksFree(ctx: QueryCtx, offer: Doc<"tradeOffers">): Promise<void> {
  const reviewed = (await leagueOffers(ctx, offer.leagueId)).filter((each) => each.review !== undefined && each._id !== offer._id);
  for (const pick of picksIn(offer)) {
    if (reviewed.some((each) => picksIn(each).some((other) => samePick(pick, other)))) refuse(pickRefusals.held(await pickName(ctx, pick)));
  }
}

/** A pick trade that went through: the team that offered it, the team it was to, and its picks. */
export type PickTrade = { fromTeamId: Id<"teams">; toTeamId: Id<"teams">; picks: TradePicks };

/** `traded` once `trade` goes through: each pick is its new owner's, a pick back with its own team
 *  losing its entry. */
function withTrade(traded: readonly TradedPick<Id<"teams">>[], { fromTeamId, toTeamId, picks }: PickTrade): TradedPick<Id<"teams">>[] {
  const moves = [
    { pick: picks.gives, ownerId: toTeamId },
    { pick: picks.gets, ownerId: fromTeamId },
  ];
  const kept = traded.filter((each) => !moves.some(({ pick }) => samePick(each, pick)));
  return [...kept, ...moves.filter(({ pick, ownerId }) => pick.teamId !== ownerId).map(({ pick, ownerId }) => ({ ...pick, ownerId }))];
}

/** Why a pick trade is undone when the draft starts: one of its picks is in a round past the
 *  draft's last, or a trade undone before it gave back a pick it traded on. */
type UndoneWhy = { why: "roundCut"; pick: TradePick } | { why: "pickBack"; pick: TradePick };

/** The league's pick trades, first made first, played again over a draft of `rounds` rounds
 *  (#1457): a trade with a pick in a round past the last is undone, both its picks back with their
 *  old owners (Craig, 11 Nov 2026), and so is a later one trading on a pick no longer its team's,
 *  so every pick trade stays one pick for one pick. Who holds each pick after the rest. Pure. */
function tradesStanding(trades: readonly PickTrade[], rounds: number) {
  let tradedPicks: TradedPick<Id<"teams">>[] = [];
  const standing: PickTrade[] = [];
  const undone: { trade: PickTrade; because: UndoneWhy }[] = [];
  for (const trade of trades) {
    const { gives, gets } = trade.picks;
    const cut = [gives, gets].find(({ round }) => round > rounds);
    const back = [
      { pick: gives, holder: trade.fromTeamId },
      { pick: gets, holder: trade.toTeamId },
    ].find(({ pick, holder }) => pickOwner(tradedPicks, pick.round, pick.teamId) !== holder)?.pick;
    if (cut !== undefined) undone.push({ trade, because: { why: "roundCut", pick: cut } });
    else if (back !== undefined) undone.push({ trade, because: { why: "pickBack", pick: back } });
    else {
      tradedPicks = withTrade(tradedPicks, trade);
      standing.push(trade);
    }
  }
  return { tradedPicks, standing, undone };
}

/** The pick trade goes through: each pick is its new owner's, a pick back with its own team losing
 *  its entry, the trade is kept in the draft's pick trades, and any other open offer holding
 *  either pick closes. */
export async function movePicks(ctx: MutationCtx, offer: Doc<"tradeOffers">, picks: TradePicks): Promise<void> {
  const trade = { fromTeamId: offer.fromTeamId, toTeamId: offer.toTeamId, picks };
  const moves = [picks.gives, picks.gets];
  const draft = await draftOf(ctx, offer.leagueId);
  const fields = { tradedPicks: withTrade(draft?.tradedPicks ?? [], trade), pickTrades: [...(draft?.pickTrades ?? []), trade] };
  if (draft === null) await ctx.db.insert("drafts", { leagueId: offer.leagueId, ...fields });
  else await ctx.db.patch("drafts", draft._id, fields);
  for (const other of await leagueOffers(ctx, offer.leagueId)) {
    if (other._id === offer._id || other.review !== undefined) continue;
    const taken = picksIn(other).find((pick) => moves.some((move) => samePick(pick, move)));
    if (taken !== undefined) await closeOffer(ctx, other, { why: "pickTraded", pickName: await pickName(ctx, taken) });
  }
}

/** The draft starts with `rounds` rounds: each pick trade the rounds undo (`tradesStanding`) is
 *  undone, and both its managers are told in Mail why (Craig, 11 Nov 2026, on #1457). */
export async function undoCutTrades(ctx: MutationCtx, league: Doc<"leagues">, rounds: number): Promise<void> {
  const draft = await draftOf(ctx, league._id);
  if (draft?.pickTrades === undefined) return;
  const { tradedPicks, standing, undone } = tradesStanding(draft.pickTrades, rounds);
  if (undone.length === 0) return;
  await ctx.db.patch("drafts", draft._id, { tradedPicks, pickTrades: standing });
  for (const { trade, because } of undone) {
    const offer = { ...trade, gives: [], gets: [] };
    const letter = pickTradeUndoneLetter(await tradeWordsOf(ctx, offer), await pickName(ctx, because.pick), because, rounds);
    await fileLetter(ctx, league, await managersOf(ctx, offer), letter);
  }
}

/** The draft has started: every pick trade still open or in review closes unmade, its review's
 *  timer cancelled, and both managers are told why. */
export async function closePickTrades(ctx: MutationCtx, leagueId: Id<"leagues">): Promise<void> {
  for (const offer of await leagueOffers(ctx, leagueId)) {
    if (offer.picks === undefined) continue;
    if (offer.review !== undefined) await ctx.scheduler.cancel(offer.review.scheduledId);
    await closeOffer(ctx, offer, { why: "draftStarted" });
  }
}
