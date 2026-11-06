// Where a matchup is: the matchup page, its team, gameweek and game in the address's search, so a
// fixture anywhere can link to it (#34, #913).

import type { Id } from "../../convex/_generated/dataModel";
import { MATCHUP_PATH } from "../frame/menu";

/** The address's search: the team whose matchup it is, the gameweek, and which of the team's games
 *  in it (from 1, in a league playing two a gameweek). Each left out means the manager's own team,
 *  the latest gameweek begun, or the team's first game in it. */
export type MatchupSearch = { team?: Id<"teams">; gameweek?: number; game?: number };

/** A link's `to` and `search` for a team's matchup in a gameweek: its first game there, or the
 *  `game` named, which the address holds only past the first, so a league playing one a gameweek
 *  keeps its addresses. */
export const matchupLink = (team: Id<"teams">, gameweek: number, game = 1) => ({
  to: MATCHUP_PATH,
  search: (game === 1 ? { team, gameweek } : { team, gameweek, game }) satisfies MatchupSearch,
});

/** A whole number, or undefined for anything else. */
const wholeOf = (value: unknown) => (typeof value === "number" && Number.isInteger(value) ? value : undefined);

/** The search as the address holds it, anything else dropped: a gameweek and a game must be whole
 *  numbers, and a game at least 1. */
export function matchupSearchOf(search: Record<string, unknown>): MatchupSearch {
  const { team, gameweek, game } = search;
  const gameNumber = wholeOf(game);
  return {
    team: typeof team === "string" && team !== "" ? (team as Id<"teams">) : undefined,
    gameweek: wholeOf(gameweek),
    game: gameNumber !== undefined && gameNumber >= 1 ? gameNumber : undefined,
  };
}
