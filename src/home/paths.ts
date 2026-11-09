// Where League home's weekly recap is read whole (#387): its own page, the gameweek in the
// address's search, so Read the recap and a letter can link to it.

import { HOME_PATH } from "../frame/menu";
import { wholeNumber } from "../shared/search";

export const RECAP_PATH = `${HOME_PATH}/recap`;

/** The address's search: the gameweek whose recap it is. */
export type RecapSearch = { gameweek?: number };

/** A link's `to` and `search` for the gameweek's recap. */
export const recapLink = (gameweek: number) => ({ to: RECAP_PATH, search: { gameweek } satisfies RecapSearch });

/** The search as the address holds it: a gameweek must be a whole number, else it is dropped. */
export function recapSearchOf({ gameweek }: Record<string, unknown>): RecapSearch {
  return { gameweek: wholeNumber(gameweek) };
}
