import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { MOST_IN_SQUAD, MOST_TEAMS } from "../leagues/leagueLimits";
import { positionsNow } from "../positions/playerPositions";
import { clubRecord, position } from "../schema";
import { takeAllOrThrow } from "../shared/cappedRead";
import { memberOf, teamsOf } from "../shared/leagueAccess";
import { clubOf, currentClubs, currentPlayersAt } from "../shared/players";
import { newestSeasonWithTotals, seasonTotals } from "../stats/seasonStats";
import type { Stats } from "../stats/statTotals";
import { listOf, shownStat } from "./playersOrder";
import { checkCatalogueStat } from "../scoring/statCatalogue";

// Scouting's players list (spec/19, The players list; #373): every Premier League player now, for
// anyone in the league, filtered and sorted here on the server so the screen never holds a cut
// list. Each player says who owns him in this league. Season points under the site's scoring are
// null ("—") for now: a player's points depend on the slot he starts in (scoring.ts), and how the
// list adds up a season of them isn't built. Waivers aren't built, so no player is on waivers.
// Any stat of the catalogue can be shown beside them as a season total and sorted by (spec/19,
// "sortable by any stat"), read from the totals kept as records are written (seasonStats.ts), for
// the newest season with any: last season's until the new one's first match (#647).

/** The most players the list reads: the Premier League's 20 squads as FPL lists them, a few dozen
 *  a club, with room. Each costs one read of his positions row, so a full list stays far inside a
 *  query's read limits. More throws, never a silent cut. */
export const LISTED_PLAYERS_MOST = 1200;

/** The most players a league can own: every team's squad full. */
export const OWNED_IN_LEAGUE_MOST = MOST_TEAMS * MOST_IN_SQUAD;

/** Which players by who holds them in this league: all, the unowned (free agents), those on
 *  waivers, or those on a team. */
export const availability = v.union(v.literal("all"), v.literal("freeAgents"), v.literal("onWaivers"), v.literal("owned"));
export type Availability = Infer<typeof availability>;

/** What the list can be sorted by: "stat" is the shown stat's season total. */
const sortColumn = v.union(v.literal("name"), v.literal("club"), v.literal("seasonPoints"), v.literal("stat"));
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
    if (stat !== null) checkCatalogueStat(stat);
    if (sort.by === "stat" && stat === null) throw new Error("The list can't be sorted by the stat with none shown");
    const clubs = (await currentClubs(ctx)).sort((one, other) => one.name.localeCompare(other.name));
    const listedClubs = filters.clubCode === null ? clubs : clubs.filter((each) => each.code === filters.clubCode);
    const players = await currentPlayersOf(ctx, listedClubs);
    const ownerOf = await ownersIn(ctx, leagueId);
    const positionsOfNow = await positionsNow(ctx);
    const season = stat === null ? null : await newestSeasonWithTotals(ctx);
    const totals = season === null ? new Map<number, Stats>() : await seasonTotals(ctx, season);
    const listedClubOf = new Map(clubs.map((each) => [each.code, clubOf(each)]));

    const rows = await Promise.all(
      players.map(async (player) => ({
        code: player.code,
        name: player.name,
        fullName: player.fullName,
        club: listedClubOf.get(player.clubCode)!,
        positions: await positionsOfNow(player.code),
        ownerTeamName: ownerOf.get(player.code) ?? null,
        seasonPoints: null,
        stat: shownStat(totals.get(player.code), stat),
      })),
    );
    return { clubs: [...listedClubOf.values()], players: listOf(rows, filters, sort) };
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
