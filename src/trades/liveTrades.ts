import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { refusalOf } from "../shared/refusal";
import { useMinute } from "../shared/useMinute";
import type { TradeChanges, TradesSeam } from "./seam";
import { tradeFailedWords } from "./words";

/** Trades' seam filled in by Convex. */
export const liveTrades: TradesSeam = {
  // Asked at the screen's minute, as a query may not read the clock: whether trades are shut moves on with it.
  useTrades: (leagueId) =>
    useQuery(api.trades.tradeScreen.ofMyTeam, { leagueId, now: useMinute() }),
  useTradeChanges: function useTradeChanges() {
    const offer = useMutation(api.trades.tradeOffers.offer);
    const counter = useMutation(api.trades.tradeOffers.counter);
    const accept = useMutation(api.trades.tradeOffers.accept);
    const reject = useMutation(api.trades.tradeOffers.reject);
    const withdraw = useMutation(api.trades.tradeOffers.withdraw);
    return useMemo<TradeChanges>(
      () => ({
        offer: (leagueId, toTeamId, terms) =>
          refusalOf(
            () => offer({ leagueId, toTeamId, ...terms }),
            "Making a trade offer",
            tradeFailedWords,
          ),
        counter: (leagueId, offerId, terms) =>
          refusalOf(
            () => counter({ leagueId, offerId, ...terms }),
            "Countering a trade offer",
            tradeFailedWords,
          ),
        accept: (leagueId, offerId) =>
          refusalOf(
            () => accept({ leagueId, offerId }),
            "Accepting a trade offer",
            tradeFailedWords,
          ),
        reject: (leagueId, offerId) =>
          refusalOf(
            () => reject({ leagueId, offerId }),
            "Rejecting a trade offer",
            tradeFailedWords,
          ),
        withdraw: (leagueId, offerId) =>
          refusalOf(
            () => withdraw({ leagueId, offerId }),
            "Withdrawing a trade offer",
            tradeFailedWords,
          ),
      }),
      [offer, counter, accept, reject, withdraw],
    );
  },
};
