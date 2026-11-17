import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { clockHourOf } from "../../convex/home/homeAt";
import { tradesAt, tradesInHourAt } from "../../convex/trades/tradesAt";
import { refusalOf } from "../shared/refusal";
import { useLastLoaded } from "../shared/useLastLoaded";
import { useMinute } from "../shared/useMinute";
import type { TradeChanges, TradesSeam } from "./seam";
import { tradeFailedWords } from "./words";

/** Trades' seam filled in by Convex. */
export const liveTrades: TradesSeam = {
  // Asked for the hour, never the minute (#2008): whether trades are shut and when each offer closes
  // move on with the clock, so they are worked out here at the screen's minute (tradesAt.ts). The
  // last answer is held across the hour's turn, so a half-made offer survives the clock (#1747);
  // once a deadline past its hour falls, it can't say the minute, so the last minute's stays up.
  useTrades: function useTrades(leagueId) {
    const minute = useMinute();
    const loaded = useQuery(api.trades.tradeScreen.ofMyTeam, { leagueId, hour: clockHourOf(minute) });
    const held = useLastLoaded(loaded, leagueId);
    const shown = useMemo(() => {
      if (loaded !== undefined) return tradesInHourAt(loaded, minute);
      return held === undefined ? undefined : tradesAt(held, minute);
    }, [loaded, held, minute]);
    return useLastLoaded(shown, leagueId);
  },
  useReviews: (leagueId) =>
    useQuery(api.trades.reviewScreen.toReview, { leagueId }),
  useTradeChanges: function useTradeChanges() {
    const offer = useMutation(api.trades.tradeOffers.offer);
    const counter = useMutation(api.trades.tradeOffers.counter);
    const accept = useMutation(api.trades.tradeOffers.accept);
    const reject = useMutation(api.trades.tradeOffers.reject);
    const withdraw = useMutation(api.trades.tradeOffers.withdraw);
    const block = useMutation(api.trades.tradeReview.block);
    const against = useMutation(api.trades.tradeReview.against);
    const takeBack = useMutation(api.trades.tradeReview.takeBack);
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
        block: (leagueId, offerId) =>
          refusalOf(
            () => block({ leagueId, offerId }),
            "Blocking a trade",
            tradeFailedWords,
          ),
        against: (leagueId, offerId) =>
          refusalOf(
            () => against({ leagueId, offerId }),
            "Voting against a trade",
            tradeFailedWords,
          ),
        takeBack: (leagueId, offerId) =>
          refusalOf(
            () => takeBack({ leagueId, offerId }),
            "Taking back a vote against a trade",
            tradeFailedWords,
          ),
      }),
      [offer, counter, accept, reject, withdraw, block, against, takeBack],
    );
  },
};
