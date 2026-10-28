import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { PL_SEASON_START_YEAR } from "../football/football";
import { currentPositions } from "../positions/playerPositions";
import { howPositionsCount } from "../positions/positionSettings";
import { clubRecord, position } from "../schema";
import { STAT_CATALOGUE } from "../scoring/statCatalogue";
import { memberOf, teamsOf } from "../shared/leagueAccess";
import { currentClubs, currentPlayersAt } from "../shared/players";
import { seasonTotals } from "../stats/seasonStats";
import type { Stats } from "../stats/statTotals";
import { ownersIn } from "../squads/squadPlaces";
import { listOf, shownStat } from "./playersOrder";

// Scouting's players list (spec/19, The players list; #373): every Premier League player now, for
// anyone in the league, filtered and sorted here on the server so the screen never holds a cut
// list. Each player says who owns him in this league. Season points under the site's scoring are
// null ("—") for now: a player's points depend on the slot he starts in (scoring.ts), and how the
// list adds up a season of them isn't built. Waivers aren't built, so no player is on waivers.
// Any stat of the catalogue can be shown beside them as a season total and sorted by (spec/19,
// "sortable by any stat"), read from the totals kept as records are written (seasonStats.ts).

/** The most players the list reads: the Premier League's 20 squads as FPL lists them, a few dozen
 *  a club, with room. Each costs one read of his positions row, so a full list stays far inside a
 *  query's read limits. More throws, never a silent cut. */
export const LISTED_PLAYERS_MOST = 1200;

/** Which players by who holds them in this league: all, the unowned (free agents), those on
 *  waivers, or those on a team. */
export const availability = v.union(v.literal("all"), v.literal("freeAgents"), v.literal("onWaivers"), v.literal("owned"));
export type Availability = Infer<typeof availability>;

/** What the list can be sorted by: "stat" is the shown stat's season total. */
export const sortColumn = v.union(v.literal("name"), v.literal("club"), v.literal("seasonPoints"), v.literal("stat"));
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
  /** His points this season under the site's scoring, or null ("—") until the list adds them up. */
  seasonPoints: v.union(v.number(), v.null()),
  /** His season total of the shown stat, 0 if he hasn't played; null with no stat shown. */
  stat: v.union(v.number(), v.null()),
});
export type ListedPlayer = Infer<typeof listedPlayer>;

const playersList = v.object({
  /** Every club now, by name, for the club filter. */
  clubs: v.array(clubRecord),
  players: v.array(listedPlayer),
});
export type PlayersList = Infer<typeof playersList>;

/** Every club now, and the players the filters keep in the sort's order (`listOf`), each with his
 *  season total of `stat` when one is shown (a catalogue stat's key, or null). Only the chosen
 *  club's players are read. Anyone not in the league is refused, as is a stat the catalogue doesn't
 *  hold, or a sort by the stat with none shown. */
export const list = query({
  args: { leagueId: v.id("leagues"), filters, sort, stat: v.union(v.string(), v.null()) },
  returns: playersList,
  handler: async (ctx, { leagueId, filters, sort, stat }) => {
    await memberOf(ctx, leagueId);
    if (stat !== null && !STAT_CATALOGUE.some((each) => each.stat === stat)) throw new Error(`No stat ${stat} is in the catalogue`);
    if (sort.by === "stat" && stat === null) throw new Error("The list can't be sorted by the stat with none shown");
    const clubs = (await currentClubs(ctx)).sort((one, other) => one.name.localeCompare(other.name));
    const listedClubs = filters.clubCode === null ? clubs : clubs.filter((each) => each.code === filters.clubCode);
    const players = await currentPlayersOf(ctx, listedClubs);
    const ownerOf = await ownerNamesIn(ctx, leagueId);
    const how = await howPositionsCount(ctx);
    const totals = stat === null ? new Map<number, Stats>() : await seasonTotals(ctx, PL_SEASON_START_YEAR);
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
        stat: shownStat(totals.get(player.code), stat),
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
async function ownerNamesIn(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Map<number, string>> {
  const teamName = new Map((await teamsOf(ctx, leagueId)).map((team) => [team._id, team.name]));
  const owners = await ownersIn(ctx, leagueId, "the list would be cut short");
  return new Map([...owners].map(([playerCode, teamId]) => [playerCode, teamName.get(teamId)!]));
}
