import type { Id } from "../../convex/_generated/dataModel";
import type { ScreenOffer, TradedPlayer } from "./seam";

// An offer as the manager reads it (#383): what he gets and gives, which team it is with, and which
// of the Offers tab's groups it sits in. Pure: no I/O.

export type OfferGroup = "toYou" | "fromYou" | "inReview";
/** The groups in the Offers tab's order. */
export const OFFER_GROUPS: readonly OfferGroup[] = [
  "toYou",
  "fromYou",
  "inReview",
];

export type OfferSides = {
  group: OfferGroup;
  /** He made it. */
  fromYou: boolean;
  otherTeamId: Id<"teams">;
  otherTeamName: string;
  youGet: TradedPlayer[];
  youGive: TradedPlayer[];
  /** A pick trade's pick each way, as its letters name it; null for a players' trade. */
  pickYouGet: string | null;
  pickYouGive: string | null;
};

/** The offer from `myTeamId`'s side. */
export function sidesOf(offer: ScreenOffer, myTeamId: Id<"teams">): OfferSides {
  const fromYou = offer.fromTeamId === myTeamId;
  return {
    group:
      offer.reviewEndsAt !== null ? "inReview" : fromYou ? "fromYou" : "toYou",
    fromYou,
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
