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
import { shownSeasonPoints } from "./shownSeasonPoints";
import { withOwnStats } from "../scoring/ownStats";
import type { StoredScoringSet } from "../scoring/scoringSetShape";
import { setOf, siteVersions } from "../scoring/siteVersions";
import { CATALOGUE_STATS } from "../scoring/statCatalogue";
import { latestRules } from "../rules/rulesHistory";
import { WAIVER_PLAYERS_READ_MOST } from "../waivers/waiverRun";
import { firstRunFrom } from "../waivers/waiverTimes";

// Scouting's players list (spec/19, The players list; #373): every Premier League player now, for
// anyone in the league, filtered and sorted here on the server so the screen never holds a cut
// list. Each player says who owns him in this league, and his season points under the site's
// scoring: his card's total in the league, at his main position (seasonPoints.ts, #525), or last
// season's before the new season's first match (shownSeasonPoints.ts, #956). One on waivers says
// the run that can first take him (#1200).
// Any stat of the catalogue, or of the site set's own stats (#910), can be shown beside them as a
// season total and sorted by (spec/19, "sortable by any stat"), read from the totals kept as
// records are written (seasonStats.ts), for the newest season with any: last season's until the
// new one's first match (#647). An own stat's total is worked out from those totals as a match's
// is from its record (ownStats.ts), by the site's latest set, the one Player scoring shows.

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
  /** The team in this league that owns him, or null for nobody's. */
  ownerTeamName: v.union(v.string(), v.null()),
  /** While he is on waivers (spec/08), the run that can first take him, or null with no run times
   *  set (Craig, 6 Nov 2026, on #1200: "Show the run's day and time"); null when he isn't. */
  onWaivers: v.union(v.object({ firstRunAt: v.union(v.number(), v.null()) }), v.null()),
  /** His points this season under the site's scoring, as his card adds them up in this league
   *  (seasonPoints.ts), or null ("—") while none of his matches is priced; before the new season's
   *  first match, last season's, null for a newcomer (shownSeasonPoints.ts). */
  seasonPoints: v.union(v.number(), v.null()),
  /** His season total of the shown stat, 0 if he hasn't played; null with no stat shown. */
  stat: v.union(v.number(), v.null()),
});
export type ListedPlayer = Infer<typeof listedPlayer>;

/** One of the site set's own stats (spec/14, Own stats), as the stat box offers it. */
const offeredOwnStat = v.object({ stat: v.string(), name: v.string(), shortCode: v.string() });

const playersList = v.object({
  /** Every club now, by name, for the club filter. */
  clubs: v.array(clubRecord),
  /** The site's latest set's own stats, in its order, offered beside the catalogue's (#910). */
  ownStats: v.array(offeredOwnStat),
  players: v.array(listedPlayer),
  /** The season the points are from while they are last season's, by the year it starts, for the
   *  head to name ("Pts 25/26"); null while they are this season's. */
  pointsSeason: v.union(v.number(), v.null()),
});
export type PlayersList = Infer<typeof playersList>;

/** Every club now, and the players the filters keep in the sort's order (`listOf`), each with his
 *  season total of `stat` when one is shown (a catalogue stat's key, an own stat's of the site's
 *  latest set, or null), and that set's own stats. Only the chosen club's players are read. Anyone
 *  not in the league is refused, as is a stat neither holds, or a sort by the stat with none shown. */
export const list = query({
  args: { leagueId: v.id("leagues"), filters, sort, stat: v.union(v.string(), v.null()) },
  returns: playersList,
  handler: async (ctx, { leagueId, filters, sort, stat }) => {
    await memberOf(ctx, leagueId);
    const set = setOf((await siteVersions(ctx)).at(-1));
    const ownStats = (set.ownStats ?? []).map(({ stat, name, shortCode }) => ({ stat, name, shortCode }));
    if (stat !== null) checkShownStat(stat, ownStats);
    if (sort.by === "stat" && stat === null) throw new Error("The list can't be sorted by the stat with none shown");
    const clubs = (await currentClubs(ctx)).sort((one, other) => one.name.localeCompare(other.name));
    const listedClubs = filters.clubCode === null ? clubs : clubs.filter((each) => each.code === filters.clubCode);
    const players = await currentPlayersOf(ctx, listedClubs);
    const ownerOf = await ownersIn(ctx, leagueId);
    const onWaiversOf = await onWaiversIn(ctx, leagueId);
    const positionsOfNow = await positionsNow(ctx, leagueId);
    const { lastSeason, pointsOf } = await shownSeasonPoints(ctx, leagueId);
    const season = stat === null ? null : await newestSeasonWithTotals(ctx);
    const totals = season === null ? new Map<number, Stats>() : await seasonTotals(ctx, season);
    const listedClubOf = new Map(clubs.map((each) => [each.code, clubOf(each)]));

    const rows = await Promise.all(
      players.map(async (player) => {
        const positions = await positionsOfNow(player.code);
        return {
          code: player.code,
          name: player.name,
          fullName: player.fullName,
          club: listedClubOf.get(player.clubCode)!,
          positions,
          ownerTeamName: ownerOf.get(player.code) ?? null,
          onWaivers: onWaiversOf.get(player.code) ?? null,
          seasonPoints: pointsOf(player.code, positions),
          stat: shownStat(withOwnTotals(totals.get(player.code), stat, set), stat),
        };
      }),
    );
    return { clubs: [...listedClubOf.values()], ownStats, players: listOf(rows, filters, sort), pointsSeason: lastSeason };
  },
});

/** Refuses a stat that is neither the catalogue's nor one of `ownStats`. */
function checkShownStat(stat: string, ownStats: readonly { stat: string }[]): void {
  if (!CATALOGUE_STATS.has(stat) && !ownStats.some((own) => own.stat === stat)) {
    throw new Error(`No stat ${stat} is in the catalogue or the site's own stats`);
  }
}

/** A player's season totals with the site's own stats worked out from them (ownStats.ts) when the
 *  shown stat is one; as they are otherwise, undefined for a player with none. */
function withOwnTotals(totals: Stats | undefined, stat: string | null, set: StoredScoringSet): Stats | undefined {
  if (totals === undefined || stat === null || CATALOGUE_STATS.has(stat)) return totals;
  return withOwnStats(totals, set);
}

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

/** Each player on the league's waivers, by his code, with the run that can first take him. */
async function onWaiversIn(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Map<number, { firstRunAt: number | null }>> {
  const runs = (await latestRules(ctx, leagueId)).waivers.runs;
  const onWaivers = await takeAllOrThrow(
    ctx.db.query("waiverPlayers").withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId)),
    WAIVER_PLAYERS_READ_MOST,
    `More than ${WAIVER_PLAYERS_READ_MOST} players are on waivers in league ${leagueId}, so the list would be cut short`,
  );
  return new Map(onWaivers.map((row) => [row.playerCode, { firstRunAt: firstRunFrom(runs, row.claimableFrom) }]));
}
