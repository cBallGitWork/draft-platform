// Trades' New offer tab's address (#383): Counter opens it filled with the offer it answers, and a
// player card's Offer a trade with his owner chosen and him asked for (#1027), each named in the
// address's search.

import type { Id } from "../../convex/_generated/dataModel";
import { TRADES_NEW_PATH } from "../frame/menu";
import { idOf, wholeNumber } from "../shared/search";

/** The address's search: the offer a counter answers, or the team to trade with and the player of
 *  theirs asked for. */
export type NewOfferSearch = { counter?: Id<"tradeOffers">; team?: Id<"teams">; player?: number };

/** A link's `to` and `search` for countering the offer. */
export const counterLink = (offerId: Id<"tradeOffers">) => ({
  to: TRADES_NEW_PATH,
  search: { counter: offerId } satisfies NewOfferSearch,
});

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
