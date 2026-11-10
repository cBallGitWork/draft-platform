// Trades' addresses (#383): the Offers tab with an offer or a trade in review selected, as a Mail
// letter's one link opens it; and New offer, which Counter opens filled with the offer it answers,
// and a player card's Offer a trade with his owner chosen and him asked for (#1027), each named in
// the address's search.

import type { Id } from "../../convex/_generated/dataModel";
import { TRADES_NEW_PATH, TRADES_PATH } from "../frame/menu";
import { idOf, wholeNumber } from "../shared/search";

/** The address's search: the offer a counter answers, or the team to trade with and the player of
 *  theirs asked for. */
export type NewOfferSearch = { counter?: Id<"tradeOffers">; team?: Id<"teams">; player?: number };

/** A link's `to` and `search` for countering the offer. */
export const counterLink = (offerId: Id<"tradeOffers">) => ({
  to: TRADES_NEW_PATH,
  search: { counter: offerId } satisfies NewOfferSearch,
});

/** The Offers tab's search: the offer or trade in review it opens with selected, as a Mail
 *  letter's one link names it (docs/design/approved/mail, The one link). */
export type OffersSearch = { offer?: Id<"tradeOffers"> };

/** A link's `to` and `search` for the Offers tab with `offerId` selected. */
export const offerLink = (offerId: Id<"tradeOffers">) => ({
  to: TRADES_PATH,
  search: { offer: offerId } satisfies OffersSearch,
});

/** The Offers tab's search as the address holds it; any other is dropped. */
export const offersSearchOf = ({ offer }: Record<string, unknown>): OffersSearch => ({ offer: idOf<"tradeOffers">(offer) });

/** A link's `to` and `search` for offering `teamId` a trade for their player `playerCode`. */
export const offerForLink = (teamId: Id<"teams">, playerCode: number) => ({
  to: TRADES_NEW_PATH,
  search: { team: teamId, player: playerCode } satisfies NewOfferSearch,
});

/** The search as the address holds it: a counter names an offer by its id, a team by its id and a
 *  player by his code; any other is dropped. */
export function newOfferSearchOf({ counter, team, player }: Record<string, unknown>): NewOfferSearch {
  return { counter: idOf<"tradeOffers">(counter), team: idOf<"teams">(team), player: wholeNumber(player) };
}
