// Where Tactics opens with a player selected: his code in the address's search, so another page can
// link to him there (#1008; the Squad tab's Set his role).

import { MY_TEAM_PATH } from "../../frame/menu";
import { wholeNumber } from "../../shared/search";

/** The address's search: the squad player whose panel opens. Left out, none does. */
type TacticsSearch = { player?: number };

/** A link's `to` and `search` for Tactics with a player selected, by his season-stable code. */
export const tacticsLink = (playerCode: number) => ({ to: MY_TEAM_PATH, search: { player: playerCode } satisfies TacticsSearch });

/** The search as the address holds it, anything else dropped: a player is a whole number. */
export function tacticsSearchOf(search: Record<string, unknown>): TacticsSearch {
  const { player } = search;
  return { player: wholeNumber(player) };
}
