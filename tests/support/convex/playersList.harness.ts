import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Period } from "../../../convex/scouting/periods";
import type { PlayersFilters, PlayersList, PlayersSort } from "../../../convex/scouting/playersList";
import { listOf } from "../../../convex/scouting/playersOrder";
import type { actingAs } from "./leagues.harness";

// Scouting's players list as the screen shows it (#1552): the server asked for the club, the stat
// and the period, and the filters and the sort worked on what it sends, as liveScouting.ts does.

/** All players, by name. */
export const ALL: PlayersFilters = { availability: "all", position: null, clubCode: null };
export const BY_NAME: PlayersSort = { by: "name", descending: false };

/** The list `as` reads in `leagueId`, filtered and sorted as the screen does. */
export async function playersListed(
  as: Awaited<ReturnType<typeof actingAs>>,
  leagueId: Id<"leagues">,
  { filters = ALL, sort = BY_NAME, stat = null, period }: { filters?: PlayersFilters; sort?: PlayersSort; stat?: string | null; period?: Period },
): Promise<PlayersList> {
  const list = await as.query(api.scouting.playersList.list, { leagueId, clubCode: filters.clubCode, stat, period });
  return { ...list, players: listOf(list.players, filters, sort) };
}
