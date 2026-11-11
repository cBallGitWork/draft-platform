import type { FunctionArgs } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { keepScoutingPlayers } from "../../../convex/scouting/scoutingPlayers";
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

type Reader = Awaited<ReturnType<typeof actingAs>>;

/** The list `as` reads in `leagueId`, filtered and sorted as the screen does. */
export async function playersListed(
  as: Reader,
  leagueId: Id<"leagues">,
  { filters = ALL, sort = BY_NAME, stat = null, period }: { filters?: PlayersFilters; sort?: PlayersSort; stat?: string | null; period?: Period },
): Promise<PlayersList> {
  const list = await serverList(as, { leagueId, clubCode: filters.clubCode, stat, period });
  return { ...list, players: listOf(list.players, filters, sort) };
}

/** The list as the server sends it to `as`, once every player's Scouting row is copied from what
 *  the test holds: tests write players, positions and season totals straight to their tables,
 *  past the writers that keep those rows (scoutingPlayers.ts, #1559; scoutingPlayers.test.ts
 *  checks the writers). */
export async function serverList(as: Reader, args: FunctionArgs<typeof api.scouting.playersList.list>): Promise<PlayersList> {
  await as.run(async (ctx) => keepScoutingPlayers(ctx, (await ctx.db.query("players").collect()).map(({ code }) => code)));
  return as.query(api.scouting.playersList.list, args);
}
