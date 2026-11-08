// Trades' New offer tab's address (#383): Counter opens it filled with the offer it answers, named
// in the address's search.

import type { Id } from "../../convex/_generated/dataModel";
import { TRADES_NEW_PATH } from "../frame/menu";

/** The address's search: the offer a counter answers. */
export type NewOfferSearch = { counter?: Id<"tradeOffers"> };

/** A link's `to` and `search` for countering the offer. */
export const counterLink = (offerId: Id<"tradeOffers">) => ({
  to: TRADES_NEW_PATH,
  search: { counter: offerId } satisfies NewOfferSearch,
});

/** The search as the address holds it: a counter names an offer by its id, else it is dropped. */
export function newOfferSearchOf({
  counter,
}: Record<string, unknown>): NewOfferSearch {
  return {
    counter:
      typeof counter === "string" && counter !== ""
        ? (counter as Id<"tradeOffers">)
        : undefined,
  };
}
