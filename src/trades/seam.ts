// The seam for Trades (#383): what its two tabs read and do. Convex fills it in live
// (liveTrades.ts); the preview and the tests hand the screens their own.

import type { Id } from "../../convex/_generated/dataModel";
import type {
  Reviewer,
  ScreenOffer,
  ScreenTeam,
  TradedPlayer,
  TradesView,
} from "../../convex/trades/tradeScreen";
import type { Change } from "../shared/refusal";

export type { Reviewer, ScreenOffer, ScreenTeam, TradedPlayer, TradesView };

/** An offer's players, by code, from the manager's side: what he gives and what he gets, and its
 *  one-line note. */
export type OfferTerms = {
  gives: number[];
  gets: number[];
  note: string | null;
};

export type TradeChanges = {
  /** Offers the team a trade. */
  offer(
    leagueId: Id<"leagues">,
    toTeamId: Id<"teams">,
    terms: OfferTerms,
  ): Change;
  /** Counters the offer to him with these terms, which closes it. */
  counter(
    leagueId: Id<"leagues">,
    offerId: Id<"tradeOffers">,
    terms: OfferTerms,
  ): Change;
  accept(leagueId: Id<"leagues">, offerId: Id<"tradeOffers">): Change;
  reject(leagueId: Id<"leagues">, offerId: Id<"tradeOffers">): Change;
  withdraw(leagueId: Id<"leagues">, offerId: Id<"tradeOffers">): Change;
};

export type TradesSeam = {
  /** The manager's offers and every team's squad, live (a hook): undefined while they load. */
  useTrades(leagueId: Id<"leagues">): TradesView | undefined;
  /** The changes a manager makes to his trades (a hook). */
  useTradeChanges(): TradeChanges;
};
