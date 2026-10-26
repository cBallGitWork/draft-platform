// Where a matchup is: the matchup page, its team and gameweek in the address's search, so a
// fixture anywhere can link to it (#34).

import type { Id } from "../../convex/_generated/dataModel";
import { MATCHUP_PATH } from "../frame/menu";

/** The address's search: the team whose matchup it is, and the gameweek. Each left out means the
 *  manager's own team, or the latest gameweek begun. */
export type MatchupSearch = { team?: Id<"teams">; gameweek?: number };

/** A link's `to` and `search` for a team's matchup in a gameweek. */
export const matchupLink = (team: Id<"teams">, gameweek: number) => ({ to: MATCHUP_PATH, search: { team, gameweek } satisfies MatchupSearch });

/** The search as the address holds it, anything else dropped: a gameweek must be a whole number. */
export function matchupSearchOf(search: Record<string, unknown>): MatchupSearch {
  const { team, gameweek } = search;
  return {
    team: typeof team === "string" && team !== "" ? (team as Id<"teams">) : undefined,
    gameweek: typeof gameweek === "number" && Number.isInteger(gameweek) ? gameweek : undefined,
  };
}
