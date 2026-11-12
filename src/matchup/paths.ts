// Where a matchup is: the matchup page, its team and gameweek in the address's search, so a
// fixture anywhere can link to it (#34).

import type { Id } from "../../convex/_generated/dataModel";
import { FIRST_GAME } from "../../convex/table/teamGames";
import { MATCHUP_PATH } from "../frame/menu";
import { idOf, wholeNumber } from "../shared/search";

/** The address's search: the team whose matchup it is, the gameweek, and which of the team's games
 *  in it, from 1 (#521). Each left out means the manager's own team, the latest gameweek begun, or
 *  the first game drawn. */
export type MatchupSearch = { team?: Id<"teams">; gameweek?: number; game?: number };

/** A link's `to` and `search` for a team's matchup in a gameweek: its first game unless another is
 *  named. The first game is left out of the address, so a league playing one a gameweek keeps its
 *  plain addresses and every link to a first game is the same address (#913, #1771). */
export const matchupLink = (team: Id<"teams">, gameweek: number, game?: number) => ({
  to: MATCHUP_PATH,
  search: (game === undefined || game === FIRST_GAME ? { team, gameweek } : { team, gameweek, game }) satisfies MatchupSearch,
});

/** The search as the address holds it, anything else dropped: a gameweek and a game must be whole
 *  numbers. */
export function matchupSearchOf(search: Record<string, unknown>): MatchupSearch {
  const { team, gameweek, game } = search;
  return {
    team: idOf<"teams">(team),
    gameweek: wholeNumber(gameweek),
    game: wholeNumber(game),
  };
}
