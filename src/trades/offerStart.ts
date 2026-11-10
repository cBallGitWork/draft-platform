// How Trades' New offer starts (#383): empty, filled with the offer a counter answers, or, from a
// player card's Offer a trade, with his owner chosen and him asked for (#1027).

import type { Id } from "../../convex/_generated/dataModel";
import { sidesOf } from "./offerSides";
import type { TradesView } from "./seam";

/** From a player card: the team to trade with, and their player asked for. */
export type Asked = { team?: Id<"teams">; player?: number };

/** How the offer starts: the team to trade with, and the codes ticked on each side. */
export type Start = { teamId: Id<"teams">; gives: number[]; gets: number[] };

/** The offer to the manager that a counter answers, from his side, as the offer starts. */
export type Countered = Start & { offerId: Id<"tradeOffers"> };

/** The offer `offerId` as a counter starts, or null for a new offer, or one he can't counter. */
export function counterOf(view: TradesView, offerId: Id<"tradeOffers"> | undefined): Countered | null {
  const offer = view.offers.find((each) => each.offerId === offerId);
  if (offer === undefined) return null;
  const sides = sidesOf(offer, view.myTeamId);
  if (sides.group !== "toYou" || offer.picks !== null) return null;
  return {
    offerId: offer.offerId,
    teamId: sides.otherTeamId,
    gives: sides.youGive.map(({ code }) => code),
    gets: sides.youGet.map(({ code }) => code),
  };
}

/** A card's Offer a trade as the offer starts: the team, when it can be traded with, and their
 *  player ticked, when he is still theirs and not held in a trade under review. Null otherwise. */
export function askedOf(view: TradesView, { team, player }: Asked): Start | null {
  const partner = view.teams.slice(1).find((each) => each.teamId === team && !each.onAutoTeam);
  if (partner === undefined) return null;
  const his = partner.players.find((each) => each.code === player && !each.held);
  return { teamId: partner.teamId, gives: [], gets: his === undefined ? [] : [his.code] };
}
