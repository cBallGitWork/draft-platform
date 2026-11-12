import type { Id } from "../../convex/_generated/dataModel";
import type { ScreenOffer, TradedPlayer } from "./seam";
import { afterLastMatchWords, closesAtWords, whenWords } from "./words";

// An offer as the manager reads it (#383): what he gets and gives, which team it is with, and which
// of the Offers tab's groups it sits in. Pure: no I/O.

export type OfferGroup = "toYou" | "fromYou" | "inReview";
/** The groups in the Offers tab's order. */
export const OFFER_GROUPS: readonly OfferGroup[] = [
  "toYou",
  "fromYou",
  "inReview",
];

/** A trade from the manager's side: who it is with, and what he gets and gives. */
export type TradeSides = {
  otherTeamId: Id<"teams">;
  otherTeamName: string;
  youGet: TradedPlayer[];
  youGive: TradedPlayer[];
  /** A pick trade's pick each way, as its letters name it; null for a players' trade. */
  pickYouGet: string | null;
  pickYouGive: string | null;
};

export type OfferSides = TradeSides & { group: OfferGroup };

/** The offer from `myTeamId`'s side. */
export function sidesOf(offer: ScreenOffer, myTeamId: Id<"teams">): OfferSides {
  const fromYou = offer.fromTeamId === myTeamId;
  return {
    group:
      offer.reviewEndsAt !== null ? "inReview" : fromYou ? "fromYou" : "toYou",
    ...tradeSidesOf(offer, myTeamId),
  };
}

/** An offer, open or closed, from `myTeamId`'s side. */
export function tradeSidesOf(
  offer: Pick<
    ScreenOffer,
    | "fromTeamId"
    | "fromTeamName"
    | "toTeamId"
    | "toTeamName"
    | "gives"
    | "gets"
    | "picks"
  >,
  myTeamId: Id<"teams">,
): TradeSides {
  const fromYou = offer.fromTeamId === myTeamId;
  return {
    otherTeamId: fromYou ? offer.toTeamId : offer.fromTeamId,
    otherTeamName: fromYou ? offer.toTeamName : offer.fromTeamName,
    youGet: fromYou ? offer.gets : offer.gives,
    youGive: fromYou ? offer.gives : offer.gets,
    pickYouGet:
      offer.picks === null
        ? null
        : fromYou
          ? offer.picks.gets
          : offer.picks.gives,
    pickYouGive:
      offer.picks === null
        ? null
        : fromYou
          ? offer.picks.gives
          : offer.picks.gets,
  };
}

/** When an offer closes, in its row's short form and its panel's long one: when its review ends,
 *  after the trade deadline's gameweek's last match, or at the next deadline; null when no deadline
 *  is left, shown as a greyed dash in both (#1788). */
export type OfferCloses = { row: string; panel: string } | null;

export function closesOf(
  offer: Pick<ScreenOffer, "reviewEndsAt" | "closes">,
): OfferCloses {
  if (offer.reviewEndsAt !== null) {
    const when = whenWords(offer.reviewEndsAt);
    return { row: when, panel: when };
  }
  if (offer.closes === null) return null;
  if (offer.closes.at === null) {
    const words = afterLastMatchWords(offer.closes.gameweek);
    return { row: words, panel: words };
  }
  const when = whenWords(offer.closes.at);
  return { row: when, panel: closesAtWords(offer.closes.gameweek, when) };
}
