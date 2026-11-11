import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { MOST_IN_SQUAD, MOST_TEAMS } from "../leagues/leagueLimits";
import { positionsFrom } from "../positions/playerPositions";
import { howPositionsCount } from "../positions/positionSettings";
import { clubRecord, position } from "../schema";
import { takeAllOrThrow } from "../shared/cappedRead";
import { memberOf, teamsOf } from "../shared/leagueAccess";
import { clubOf, currentClubs, currentPlayersAt } from "../shared/players";
import { newestSeasonWithTotals } from "../stats/seasonStats";
import type { Stats } from "../stats/statTotals";
import { checkScoutingPlayersHeld, currentScoutingPlayersAt, scoutingPlayerByCode, type ScoutingPlayer } from "./scoutingPlayers";
import { periodPointsIn, periodTotals } from "./period";
import { period } from "./periods";
import { listFigures, shownStat } from "./playersOrder";
import { shownSeasonPoints } from "./shownSeasonPoints";
import { withOwnStats } from "../scoring/ownStats";
import type { StoredScoringSet } from "../scoring/scoringSetShape";
import { setOf, siteVersions } from "../scoring/siteVersions";
import { CATALOGUE_STATS } from "../scoring/statCatalogue";
import { firstRunsIn, runAhead, type RunAhead } from "../waivers/waiverLock";
import { WAIVER_PLAYERS_READ_MOST } from "../waivers/waiverRun";

// Scouting's players list (spec/19, The players list; #373): every Premier League player now, for
// anyone in the league, whole, so the screen never holds a cut list; the browser filters and sorts
// it (playersOrder.ts's listOf, #1552). Each player says who owns him in this league, and his season points under the site's
// scoring: his card's total in the league, at his main position (seasonPoints.ts, #525), or last
// season's before the new season's first match (shownSeasonPoints.ts, #956). One on waivers says
// the run that can first take him (#1200).
// Each row shows his season's minutes, goals, assists and shots on target (the approved picture).
// Any stat of the catalogue, or of the site set's own stats (#910), can be shown beside them as a
// season total and sorted by (spec/19, "sortable by any stat"), read from the totals kept as
// records are written (seasonStats.ts), for the newest season with any: last season's until the
// new one's first match (#647). An own stat's total is worked out from those totals as a match's
// is from its record (ownStats.ts), by the site's latest set, the one Player scoring shows.
// The figures, the shown stat and the Pts column follow the list's period (period.ts; #1028, story
// 3): the season, or the last 4 or 6 finished gameweeks. His season points stay beside them, for
// his panel.
// Each player is read from his one Scouting row (scoutingPlayers.ts, #1559): his name, club,
// what his positions are worked out from by the league's settings, and his season's totals.

/** The most players the list reads: the Premier League's 20 squads as FPL lists them, a few dozen
 *  a club, with room. Each costs one read of his Scouting row, so a full list stays far inside a
 *  query's read limits. More throws, never a silent cut. */
export const LISTED_PLAYERS_MOST = 1200;

/** The most players a league can own: every team's squad full. */
export const OWNED_IN_LEAGUE_MOST = MOST_TEAMS * MOST_IN_SQUAD;

/** Which players by who holds them in this league: all, the unowned (free agents), those on
 *  waivers, or those on a team. */
export const availability = v.union(v.literal("all"), v.literal("freeAgents"), v.literal("onWaivers"), v.literal("owned"));
export type Availability = Infer<typeof availability>;

/** The season totals every row shows (playersOrder.ts's LIST_FIGURES). */
const listFigure = v.union(v.literal("minutes"), v.literal("goals"), v.literal("assists"), v.literal("shotsOnTarget"));
export type ListFigure = Infer<typeof listFigure>;

/** What the list can be sorted by: "points" is his points over the period, "stat" the shown stat's
 *  total over it, and each list figure its own. */
const sortColumn = v.union(v.literal("name"), v.literal("club"), v.literal("points"), v.literal("stat"), listFigure);
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
  /** While he is on waivers (spec/08), from when a run may take him; null when he isn't. The run
   *  that can first take him moves with the clock, which this list doesn't take, so the browser
   *  asks it of `firstRuns` and adds it (`ListedPlayer`, #1467). */
  onWaivers: v.union(v.object({ claimableFrom: v.number() }), v.null()),
  /** His points this season under the site's scoring, as his card adds them up in this league
   *  (seasonPoints.ts), or null ("—") while none of his matches is priced; before the new season's
   *  first match, last season's, null for a newcomer (shownSeasonPoints.ts). */
  seasonPoints: v.union(v.number(), v.null()),
  /** His points over the list's period, the Pts column: his season points over the season; over
   *  the last few gameweeks, his matches there priced as his card prices them (period.ts), null
   *  ("—") with none priced. */
  points: v.union(v.number(), v.null()),
  /** His totals over the period of the list's own figures (LIST_FIGURES), 0 for each he hasn't. */
  figures: v.object({ minutes: v.number(), goals: v.number(), assists: v.number(), shotsOnTarget: v.number() }),
  /** His total of the shown stat over the period, 0 if he hasn't played; null with no stat shown. */
  stat: v.union(v.number(), v.null()),
});
/** A player's row as the server sends it. */
export type ListedRow = Infer<typeof listedPlayer>;
/** A player's row as the screens show it: on waivers, with the run that can first take him, still
 *  to come, or null with no run times set (Craig, 6 Nov 2026, on #1200: "Show the run's day and
 *  time"). */
export type ListedPlayer = Omit<ListedRow, "onWaivers"> & { onWaivers: { firstRun: RunAhead | null } | null };

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
  /** The gameweeks the period counts, in order: none for the season, and fewer than it names while
   *  fewer have finished. */
  periodGameweeks: v.array(v.number()),
  /** The player asked to be kept, whatever the filters keep: his row as the list would show it, so
   *  his panel follows a pickup, a claim or a drop that moves him out of the list (#1551); null once
   *  he is no longer a Premier League player. Left out when none is asked. */
  kept: v.optional(v.union(listedPlayer, v.null())),
});
/** The list as the server sends it. */
export type ListedRows = Infer<typeof playersList>;
/** The list as the screens show it, each on waivers with the run that can first take him. */
export type PlayersList = Omit<ListedRows, "players" | "kept"> & { players: ListedPlayer[]; kept?: ListedPlayer | null };

/** Every club now, and every current player (only `clubCode`'s when one is chosen, null for every
 *  club), each with his figures over `period` (the season when left out) and his total there of
 *  `stat` when one is shown (a catalogue stat's key, an own stat's of the site's latest set, or
 *  null), and that set's own stats, and the row of the player `keep` names (`kept`) whether the
 *  chosen club holds him or not (#1551). Only the chosen club's players are read, and he besides.
 *  Who holds him and his position are filtered, and the list sorted, in the browser (`listOf`), so
 *  a sort or one of those filters never reads the list again (#1552). Anyone not in the league is
 *  refused, as is a stat neither holds. */
export const list = query({
  args: { leagueId: v.id("leagues"), clubCode: v.union(v.number(), v.null()), stat: v.union(v.string(), v.null()), period: v.optional(period), keep: v.optional(v.number()) },
  returns: playersList,
  handler: async (ctx, { leagueId, clubCode, stat, period = "season", keep }): Promise<ListedRows> => {
    await memberOf(ctx, leagueId);
    const set = setOf((await siteVersions(ctx)).at(-1));
    const ownStats = (set.ownStats ?? []).map(({ stat, name, shortCode }) => ({ stat, name, shortCode }));
    if (stat !== null) checkShownStat(stat, ownStats);
    const clubs = (await currentClubs(ctx)).sort((one, other) => one.name.localeCompare(other.name));
    const listedClubs = clubCode === null ? clubs : clubs.filter((each) => each.code === clubCode);
    const players = await currentScoutingPlayersOf(ctx, listedClubs);
    if (players.length === 0) await checkScoutingPlayersHeld(ctx);
    const ownerOf = await ownersIn(ctx, leagueId);
    const onWaiversOf = await onWaiversIn(ctx, leagueId);
    const how = await howPositionsCount(ctx, leagueId);
    const { lastSeason, pointsOf } = await shownSeasonPoints(ctx, leagueId);
    // The season's totals are on each player's row; a few gameweeks' are added up from their matches.
    const over = period === "season" ? null : await periodTotals(ctx, period);
    const season = over === null ? await newestSeasonWithTotals(ctx) : null;
    const totalsOf = (player: ScoutingPlayer): Stats | undefined =>
      over === null ? (player.totals?.season === season ? player.totals.stats : undefined) : over.totals.get(player.code);
    const periodPointsOf = over === null ? pointsOf : await periodPointsIn(ctx, leagueId, over);
    const listedClubOf = new Map(clubs.map((each) => [each.code, clubOf(each)]));

    const rowOf = (player: ScoutingPlayer): ListedRow => {
      const positions = positionsFrom(player.positions, how).positions.map(({ position }) => position);
      const totals = totalsOf(player);
      return {
        code: player.code,
        name: player.name,
        fullName: player.fullName,
        club: listedClubOf.get(player.clubCode)!,
        positions,
        ownerTeamName: ownerOf.get(player.code) ?? null,
        onWaivers: onWaiversOf.get(player.code) ?? null,
        seasonPoints: pointsOf(player.code, positions),
        points: periodPointsOf(player.code, positions),
        figures: listFigures(totals),
        stat: shownStat(withOwnTotals(totals, stat, set), stat),
      };
    };
    const rows = players.map(rowOf);
    const listed = { clubs: [...listedClubOf.values()], ownStats, players: rows, pointsSeason: lastSeason, periodGameweeks: over?.gameweeks ?? [] };
    if (keep === undefined) return listed;
    const kept = rows.find(({ code }) => code === keep) ?? (await keptOutside(ctx, keep, listedClubOf, rowOf));
    return { ...listed, kept };
  },
});

/** The kept player's row when the club filter left him out, read on his own; null when he is no
 *  longer a Premier League player (dropped, or at no club now). */
async function keptOutside(
  ctx: QueryCtx,
  code: number,
  clubs: ReadonlyMap<number, unknown>,
  rowOf: (player: ScoutingPlayer) => ListedRow,
): Promise<ListedRow | null> {
  const player = await scoutingPlayerByCode(ctx, code);
  if (player === null || player.droppedAt !== undefined || !clubs.has(player.clubCode)) return null;
  return rowOf(player);
}

/** Refuses a stat that is neither the catalogue's nor one of `ownStats`. */
export function checkShownStat(stat: string, ownStats: readonly { stat: string }[]): void {
  if (!CATALOGUE_STATS.has(stat) && !ownStats.some((own) => own.stat === stat)) {
    throw new Error(`No stat ${stat} is in the catalogue or the site's own stats`);
  }
}

/** A player's season totals with the site's own stats worked out from them (ownStats.ts) when the
 *  shown stat is one; as they are otherwise, undefined for a player with none. */
export function withOwnTotals(totals: Stats | undefined, stat: string | null, set: StoredScoringSet): Stats | undefined {
  if (totals === undefined || stat === null || CATALOGUE_STATS.has(stat)) return totals;
  return withOwnStats(totals, set);
}

/** The current players at these clubs, at most LISTED_PLAYERS_MOST of them. */
export async function currentPlayersOf(ctx: QueryCtx, clubs: readonly Doc<"clubs">[]): Promise<Doc<"players">[]> {
  return listedAtMost((await Promise.all(clubs.map((each) => currentPlayersAt(ctx, each.code)))).flat());
}

/** The Scouting rows of the current players at these clubs, at most LISTED_PLAYERS_MOST of them. */
async function currentScoutingPlayersOf(ctx: QueryCtx, clubs: readonly Doc<"clubs">[]): Promise<ScoutingPlayer[]> {
  return listedAtMost((await Promise.all(clubs.map((each) => currentScoutingPlayersAt(ctx, each.code)))).flat());
}

function listedAtMost<Player>(players: Player[]): Player[] {
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

/** Each player on the league's waivers, by his code, with from when a run may take him. */
async function onWaiversIn(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Map<number, { claimableFrom: number }>> {
  const onWaivers = await takeAllOrThrow(
    ctx.db.query("waiverPlayers").withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId)),
    WAIVER_PLAYERS_READ_MOST,
    `More than ${WAIVER_PLAYERS_READ_MOST} players are on waivers in league ${leagueId}, so the list would be cut short`,
  );
  return new Map(onWaivers.map((row) => [row.playerCode, { claimableFrom: row.claimableFrom }]));
}

const firstRunOfPlayer = v.object({ playerCode: v.number(), firstRun: v.union(runAhead, v.null()) });
export type FirstRunOfPlayer = Infer<typeof firstRunOfPlayer>;

/** Each player on the league's waivers at `now` with the run that can first take him, still to
 *  come, and the gameweek whose lock it may fall in (#1467), for the list's rows. A query of its
 *  own, so the minute never reads the list again. Anyone not in the league is refused. */
export const firstRuns = query({
  args: { leagueId: v.id("leagues"), now: v.number() },
  returns: v.array(firstRunOfPlayer),
  handler: async (ctx, { leagueId, now }): Promise<FirstRunOfPlayer[]> => {
    await memberOf(ctx, leagueId);
    const firstRunOf = await firstRunsIn(ctx, leagueId, now);
    return [...(await onWaiversIn(ctx, leagueId))].map(([playerCode, { claimableFrom }]) => ({ playerCode, firstRun: firstRunOf(claimableFrom) }));
  },
});
