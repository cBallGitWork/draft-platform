import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { matchRecordsOf } from "../gameweekScorer/heldMatches";
import { positionsNow } from "../positions/playerPositions";
import { siteScoringAt } from "../scoring/siteVersions";
import { takeAllOrThrow } from "../shared/cappedRead";
import { logFailure } from "../shared/errors";
import { fixtureByCode } from "../shared/fixtures";
import { playerByCode } from "../shared/players";
import { readOnce } from "../shared/readOnce";
import { sortedJson } from "../shared/sortedJson";
import { PLAYER_RECORDS_MOST } from "../stats/matchRecords";
import { LEAGUES_STORED_MOST } from "../table/finalScores";
import { starsRow } from "./playerStars";
import { countedMatches, LEAST_MATCHES_RATED, perMatchUnder, ratedRoles, starsFor, type RatedRecord } from "./stars";
import { UNSURE } from "./starsShape";

// Stars kept up to date (#11; spec/05 Roles), stored in playerRoleStars so no read prices every
// player under every role. Two steps, each its own transaction:
// - a player's row: his counted matches priced under each role he is rated for, today's scoring;
// - the ranking: every row read, each role in each area ranked, the stars written.
// When a match locks (matchStats.ts's `lock`), its players' rows are worked out again and everyone
// ranked again; when a version of the site's scoring takes effect (siteScoring.ts), every current
// player's are, a page at a time. The first lock with no row held yet does every player, so a
// deployment fills the table by itself. A row is written only when it changes, so a screen reading
// stars isn't sent them again for nothing.
//
// A player gone from the Premier League keeps his stars while a squad in any league holds him. One
// whom no squad holds stays in the pools until the next refresh of everyone drops his row: a lock
// works out only its own players.
//
// One bad record or player never stops the rest: a match with no kickoff held is left out of his
// matches, and a player whose rating throws keeps the row he had; each is logged.
//
// Cost: a lock reads every record of its 40-odd players, prices each one's counted matches (at most
// STARS_WINDOW) under his 2 to 24 roles, then reads every row to rank: about 700 small rows.
// Every player's refresh reads every current player's records: about 700 × 38 at a season's end, in
// STARS_PAGE pages, then the players gone from the Premier League who still hold stars, STARS_PAGE
// rows at a time. Both grow with players, roles a player is rated for and matches (capped at
// STARS_WINDOW), and not with teams; but each gone player is looked for on every league's squads,
// so that part grows with gone players × leagues (the leagues read once a transaction). A season-sized
// page and lock run in the tests (starsRefresh.season.test.ts); Convex's real time limit on them is
// unmeasured on a deployment.

/** Players worked out in one transaction of a full refresh: each reads his own records, up to a
 *  season's 38 and more across seasons, so 25 stays well inside a mutation's reads. */
export const STARS_PAGE = 25;

/** The most players holding stars: FPL lists about 800 a season, with room. More throws, never a
 *  silent cut. */
export const STARRED_PLAYERS_MOST = 1500;

/** After a match locks: its players' rows worked out again, then everyone ranked again. With no row
 *  held yet, every player's instead. */
export const refreshMatch = internalMutation({
  args: { fixtureCode: v.number() },
  returns: v.null(),
  handler: async (ctx, { fixtureCode }) => {
    if ((await ctx.db.query("playerRoleStars").first()) === null) {
      await ctx.scheduler.runAfter(0, internal.stars.starsRefresh.refreshAll, { cursor: null });
      return null;
    }
    const records = await matchRecordsOf(ctx, fixtureCode, "its players' stars");
    await refreshPlayers(
      ctx,
      records.map((record) => record.playerCode),
    );
    await ctx.scheduler.runAfter(0, internal.stars.starsRefresh.rank, {});
    return null;
  },
});

/** Every current player's row worked out again, a page from `cursor` (null for the first) a run;
 *  after the last, the gone players' (refreshGone), then everyone ranked. */
export const refreshAll = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query("players")
      .withIndex("by_droppedAt", (q) => q.eq("droppedAt", undefined))
      .paginate({ numItems: STARS_PAGE, cursor });
    await refreshPlayers(
      ctx,
      page.page.map((player) => player.code),
    );
    if (page.isDone) await ctx.scheduler.runAfter(0, internal.stars.starsRefresh.refreshGone, { cursor: null });
    else await ctx.scheduler.runAfter(0, internal.stars.starsRefresh.refreshAll, { cursor: page.continueCursor });
    return null;
  },
});

/** The rows of players gone from the Premier League, which a refresh of every current player never
 *  reaches, worked out again STARS_PAGE rows from `cursor` a run: kept while a squad holds him,
 *  dropped once none does. After the last, everyone ranked. */
export const refreshGone = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("playerRoleStars").withIndex("by_playerCode").paginate({ numItems: STARS_PAGE, cursor });
    const gone: number[] = [];
    for (const row of page.page) if (await isGone(ctx, row.playerCode)) gone.push(row.playerCode);
    await refreshPlayers(ctx, gone);
    if (page.isDone) await ctx.scheduler.runAfter(0, internal.stars.starsRefresh.rank, {});
    else await ctx.scheduler.runAfter(0, internal.stars.starsRefresh.refreshGone, { cursor: page.continueCursor });
    return null;
  },
});

/** Every role in every area ranked, and each row's stars written where they changed. */
export const rank = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const kept = await starsRows(ctx);
    // Early in a season the pools are small: last season's matches are to fill them once recorded
    // (Craig, 1 Nov 2026: "use past data"; #842). Until then a pool is whoever has played.
    const pools = new Map<string, number[]>();
    for (const row of kept.filter((each) => each.matches >= LEAST_MATCHES_RATED)) {
      for (const { area, role, perMatch } of row.ratings) {
        const pool = pools.get(poolKey(area, role)) ?? [];
        pool.push(perMatch);
        pools.set(poolKey(area, role), pool);
      }
    }
    for (const row of kept) {
      const ratings = row.ratings.map((rating) => ({ ...rating, stars: starsFor(row.matches, rating.perMatch, pools.get(poolKey(rating.area, rating.role)) ?? []) }));
      if (ratings.some((rating, index) => rating.stars !== row.ratings[index].stars)) await ctx.db.patch("playerRoleStars", row._id, { ratings });
    }
    return null;
  },
});

const poolKey = (area: string, role: string) => `${area}/${role}`;

/** Every row held, at most STARRED_PLAYERS_MOST. */
function starsRows(ctx: QueryCtx): Promise<Doc<"playerRoleStars">[]> {
  return takeAllOrThrow(ctx.db.query("playerRoleStars"), STARRED_PLAYERS_MOST, `More than ${STARRED_PLAYERS_MOST} players hold stars, so some would go unranked`);
}

/** Whether the football sync has dropped him, or holds no such player. */
async function isGone(ctx: QueryCtx, playerCode: number): Promise<boolean> {
  const player = await playerByCode(ctx, playerCode);
  return player === null || player.droppedAt !== undefined;
}

/** Whether a squad in any of `leagues` holds him. */
async function isOnASquad(ctx: QueryCtx, leagues: readonly Doc<"leagues">[], playerCode: number): Promise<boolean> {
  for (const league of leagues) {
    const held = await ctx.db
      .query("squadPlayers")
      .withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", league._id).eq("playerCode", playerCode))
      .first();
    if (held !== null) return true;
  }
  return false;
}

/** Whether he keeps stars: anyone the football sync holds as current, and anyone gone from the
 *  Premier League whom a squad still holds, so his manager still sees them. The leagues are read
 *  once, and only if a gone player is asked about. */
function starsKeeper(ctx: QueryCtx): (playerCode: number) => Promise<boolean> {
  let leagues: Promise<Doc<"leagues">[]> | undefined;
  return async (playerCode) => {
    if (!(await isGone(ctx, playerCode))) return true;
    leagues ??= takeAllOrThrow(ctx.db.query("leagues"), LEAGUES_STORED_MOST, `More than ${LEAGUES_STORED_MOST} leagues are held, so a squad holding a player could be missed`);
    return isOnASquad(ctx, await leagues, playerCode);
  };
}

/** Each player's row set afresh from his records and positions now, under today's scoring: his
 *  points per match under each role he is rated for, his stars kept until the ranking moves them.
 *  One with no counted match, no position, or gone from the Premier League with no squad holding
 *  him, holds no row. */
async function refreshPlayers(ctx: MutationCtx, playerCodes: readonly number[]): Promise<void> {
  const set = await siteScoringAt(ctx, Date.now());
  const positionsOf = await positionsNow(ctx);
  const keepsStars = starsKeeper(ctx);
  const kickoffOf = readOnce(async (fixtureCode: number) => {
    const kickoff = (await fixtureByCode(ctx, fixtureCode))?.kickoff ?? null;
    if (kickoff === null) logFailure(`Stars leave out match ${fixtureCode}`, "it has records but no kickoff held");
    return kickoff;
  });
  for (const playerCode of new Set(playerCodes)) {
    const row = await starsRow(ctx, playerCode);
    let fields: Omit<Doc<"playerRoleStars">, "_id" | "_creationTime"> | null;
    try {
      const records = await takeAllOrThrow(
        ctx.db.query("playerMatchStats").withIndex("by_playerCode", (q) => q.eq("playerCode", playerCode)),
        PLAYER_RECORDS_MOST,
        `More than ${PLAYER_RECORDS_MOST} match records are held for player ${playerCode}, so his stars would be cut short`,
      );
      const dated: RatedRecord[] = [];
      for (const record of records) {
        const kickoff = await kickoffOf(record.fixtureCode);
        if (kickoff !== null) dated.push({ ...record, kickoff });
      }
      const matches = countedMatches(dated);
      const roles = (await keepsStars(playerCode)) ? ratedRoles(await positionsOf(playerCode)) : [];
      const heldStars = (area: string, role: string) => row?.ratings.find((each) => each.area === area && each.role === role)?.stars ?? UNSURE;
      fields =
        matches.length === 0 || roles.length === 0
          ? null
          : {
              playerCode,
              matches: matches.length,
              ratings: roles.map(({ area, role, cell }) => ({ area, role, perMatch: perMatchUnder(matches, set, cell, role), stars: heldStars(area, role) })),
            };
    } catch (error: unknown) {
      logFailure(`Player ${playerCode}'s stars weren't worked out again, so he keeps those he had`, error);
      continue;
    }
    if (fields === null) {
      if (row !== null) await ctx.db.delete("playerRoleStars", row._id);
    } else if (row === null) await ctx.db.insert("playerRoleStars", fields);
    else if (sortedJson({ playerCode: row.playerCode, matches: row.matches, ratings: row.ratings }) !== sortedJson(fields)) await ctx.db.replace("playerRoleStars", row._id, fields);
  }
}
