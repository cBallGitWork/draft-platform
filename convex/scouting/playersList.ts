import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { MOST_IN_SQUAD, MOST_TEAMS } from "../leagues/leagueLimits";
import { currentPositions } from "../positions/playerPositions";
import { howPositionsCount } from "../positions/positionSettings";
import { clubRecord, position } from "../schema";
import { takeAllOrThrow } from "../shared/cappedRead";
import { memberOf, teamsOf } from "../shared/leagueAccess";
import { currentClubs, currentPlayersAt } from "../shared/players";
import { listOf } from "./playersOrder";

// Scouting's players list (spec/19, The players list; #373): every Premier League player now, for
// anyone in the league, filtered and sorted here on the server so the screen never holds a cut
// list. Each player says who owns him in this league. Season points under the site's scoring are
// null ("—") until #29 scores matches: a player's points depend on the slot he starts in
// (scoring.ts), and no lineups are kept yet. Waivers aren't built, so no player is on waivers.

/** The most players the list reads: the Premier League's 20 squads as FPL lists them, about 800 by
 *  a season's end, with room. More throws, never a silent cut. */
export const LISTED_PLAYERS_MOST = 1200;

/** The most players a league can own: every team's squad full. */
const OWNED_IN_LEAGUE_MOST = MOST_TEAMS * MOST_IN_SQUAD;

/** Which players by who holds them in this league: all, the unowned (free agents), those on
 *  waivers, or those on a team. */
export const availability = v.union(v.literal("all"), v.literal("freeAgents"), v.literal("onWaivers"), v.literal("owned"));
export type Availability = Infer<typeof availability>;

/** What the list can be sorted by. */
export const sortColumn = v.union(v.literal("name"), v.literal("club"), v.literal("seasonPoints"));
export type SortColumn = Infer<typeof sortColumn>;

const filters = v.object({
  availability,
  /** Only players with this position among theirs; null for every position. */
  position: v.union(position, v.null()),
  /** Only this club's players, by its code; null for every club. */
  clubCode: v.union(v.number(), v.null()),
});
export type PlayersFilters = Infer<typeof filters>;

const sort = v.object({ by: sortColumn, descending: v.boolean() });
export type PlayersSort = Infer<typeof sort>;

const listedPlayer = v.object({
  code: v.number(),
  name: v.string(),
  fullName: v.string(),
  club: clubRecord,
  positions: v.array(position),
  /** The team in this league that owns him, or null for a free agent. */
  ownerTeamName: v.union(v.string(), v.null()),
  /** His points this season under the site's scoring, or null ("—") until matches are scored (#29). */
  seasonPoints: v.union(v.number(), v.null()),
});
export type ListedPlayer = Infer<typeof listedPlayer>;

const playersList = v.object({
  /** Every club now, by name, for the club filter. */
  clubs: v.array(clubRecord),
  players: v.array(listedPlayer),
});
export type PlayersList = Infer<typeof playersList>;

/** Every club now, and the players the filters keep in the sort's order (`listOf`). Only the chosen
 *  club's players are read. Anyone not in the league is refused. */
export const list = query({
  args: { leagueId: v.id("leagues"), filters, sort },
  returns: playersList,
  handler: async (ctx, { leagueId, filters, sort }) => {
    await memberOf(ctx, leagueId);
    const clubs = (await currentClubs(ctx)).sort((one, other) => one.name.localeCompare(other.name));
    const listedClubs = filters.clubCode === null ? clubs : clubs.filter((each) => each.code === filters.clubCode);
    const players = await currentPlayersOf(ctx, listedClubs);
    const ownerOf = await ownersIn(ctx, leagueId);
    const how = await howPositionsCount(ctx);
    const clubOf = new Map(clubs.map((each) => [each.code, { code: each.code, name: each.name, shortName: each.shortName }]));

    const rows = await Promise.all(
      players.map(async (player) => ({
        code: player.code,
        name: player.name,
        fullName: player.fullName,
        club: clubOf.get(player.clubCode)!,
        positions: await currentPositions(ctx, player.code, how),
        ownerTeamName: ownerOf.get(player.code) ?? null,
        seasonPoints: null,
      })),
    );
    return { clubs: [...clubOf.values()], players: listOf(rows, filters, sort) };
  },
});

/** The current players at these clubs, at most LISTED_PLAYERS_MOST of them. */
async function currentPlayersOf(ctx: QueryCtx, clubs: readonly Doc<"clubs">[]): Promise<Doc<"players">[]> {
  const players = (await Promise.all(clubs.map((each) => currentPlayersAt(ctx, each.code)))).flat();
  if (players.length > LISTED_PLAYERS_MOST) {
    throw new Error(`More than ${LISTED_PLAYERS_MOST} players are held as current, so the list would be cut short`);
  }
  return players;
}

/** Each owned player's team name in the league, by his code. */
async function ownersIn(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Map<number, string>> {
  const teamName = new Map((await teamsOf(ctx, leagueId)).map((team) => [team._id, team.name]));
  const owned = await takeAllOrThrow(
    ctx.db.query("squadPlayers").withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId)),
    OWNED_IN_LEAGUE_MOST,
    `More than ${OWNED_IN_LEAGUE_MOST} players are owned in league ${leagueId}, so the list would be cut short`,
  );
  return new Map(owned.map((row) => [row.playerCode, teamName.get(row.teamId)!]));
}
