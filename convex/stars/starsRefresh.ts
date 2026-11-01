import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { matchRecordsOf } from "../gameweekScorer/heldMatches";
import { positionsNow } from "../positions/playerPositions";
import { siteScoringAt } from "../scoring/siteVersions";
import { takeAllOrThrow } from "../shared/cappedRead";
import { fixtureByCode } from "../shared/fixtures";
import { readOnce } from "../shared/readOnce";
import { PLAYER_RECORDS_MOST } from "../stats/matchRecords";
import { starsRow } from "./playerStars";
import { countedMatches, LEAST_MATCHES_RATED, perMatchUnder, ratedRoles, starsFor } from "./stars";
import { UNSURE } from "./starsShape";

// Stars kept up to date (#11; spec/05 Roles), stored in playerRoleStars so no read prices every
// player under every role. Two steps, each its own transaction:
// - a player's row: his counted matches priced under each role he is rated for, today's scoring;
// - the ranking: every row read, each role in each area ranked, the stars written.
// When a match locks (matchStats.ts's `lock`), its players' rows are worked out again and everyone
// ranked again; when a version of the site's scoring takes effect (siteScoring.ts), every current
// player's are, a page at a time. The first lock with no row held yet does every player, so a
// deployment fills the table by itself.
//
// Cost: a lock reads every record of its 40-odd players, prices each one's counted matches (at most
// STARS_WINDOW) under his 2 to 15 roles, then reads every row to rank: about 700 small rows.
// Every player's refresh reads every current player's records: about 700 × 38 at a season's end, in
// STARS_PAGE pages. Both grow with players, roles a player is rated for and matches (capped at
// STARS_WINDOW), never with teams or leagues: stars are the site's, not a league's.

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
      await ctx.scheduler.runAfter(0, internal.stars.starsRefresh.refreshAll, { cursor: null, startedAt: null });
      return null;
    }
    const records = await matchRecordsOf(ctx, fixtureCode, "its players' stars");
    await refreshPlayers(
      ctx,
      records.map((record) => record.playerCode),
    );
    await ctx.scheduler.runAfter(0, internal.stars.starsRefresh.rank, { startedAt: null });
    return null;
  },
});

/** Every current player's row worked out again, a page from `cursor` (null for the first) a run,
 *  then everyone ranked, dropping the rows of players it didn't reach. `startedAt` is the first
 *  page's time, null for the first. */
export const refreshAll = internalMutation({
  args: { cursor: v.union(v.string(), v.null()), startedAt: v.union(v.number(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { cursor, startedAt }) => {
    const started = startedAt ?? Date.now();
    const page = await ctx.db
      .query("players")
      .withIndex("by_droppedAt", (q) => q.eq("droppedAt", undefined))
      .paginate({ numItems: STARS_PAGE, cursor });
    await refreshPlayers(
      ctx,
      page.page.map((player) => player.code),
    );
    if (page.isDone) await ctx.scheduler.runAfter(0, internal.stars.starsRefresh.rank, { startedAt: started });
    else await ctx.scheduler.runAfter(0, internal.stars.starsRefresh.refreshAll, { cursor: page.continueCursor, startedAt: started });
    return null;
  },
});

/** Every role in every area ranked, and each row's stars written where they changed. Rows not worked
 *  out since `startedAt` are dropped first: players a refresh of every player no longer holds. */
export const rank = internalMutation({
  args: { startedAt: v.union(v.number(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { startedAt }) => {
    const rows = await takeAllOrThrow(
      ctx.db.query("playerRoleStars"),
      STARRED_PLAYERS_MOST,
      `More than ${STARRED_PLAYERS_MOST} players hold stars, so some would go unranked`,
    );
    const kept: Doc<"playerRoleStars">[] = [];
    for (const row of rows) {
      if (startedAt !== null && row.refreshedAt < startedAt) await ctx.db.delete("playerRoleStars", row._id);
      else kept.push(row);
    }
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

/** Each player's row set afresh from his records and positions now, under today's scoring: his
 *  points per match under each role he is rated for, his stars kept until the ranking moves them.
 *  One with no counted match, or no position, holds no row. */
async function refreshPlayers(ctx: MutationCtx, playerCodes: readonly number[]): Promise<void> {
  const now = Date.now();
  const set = await siteScoringAt(ctx, now);
  const positionsOf = await positionsNow(ctx);
  const kickoffOf = readOnce(async (fixtureCode: number) => {
    const kickoff = (await fixtureByCode(ctx, fixtureCode))?.kickoff ?? null;
    if (kickoff === null) throw new Error(`Match ${fixtureCode} has records but no kickoff held`);
    return kickoff;
  });
  for (const playerCode of new Set(playerCodes)) {
    const records = await takeAllOrThrow(
      ctx.db.query("playerMatchStats").withIndex("by_playerCode", (q) => q.eq("playerCode", playerCode)),
      PLAYER_RECORDS_MOST,
      `More than ${PLAYER_RECORDS_MOST} match records are held for player ${playerCode}, so his stars would be cut short`,
    );
    const matches = countedMatches(await Promise.all(records.map(async (record) => ({ ...record, kickoff: await kickoffOf(record.fixtureCode) }))));
    const roles = ratedRoles(await positionsOf(playerCode));
    const row = await starsRow(ctx, playerCode);
    if (matches.length === 0 || roles.length === 0) {
      if (row !== null) await ctx.db.delete("playerRoleStars", row._id);
      continue;
    }
    const heldStars = (area: string, role: string) => row?.ratings.find((each) => each.area === area && each.role === role)?.stars ?? UNSURE;
    const ratings = roles.map(({ area, role, cell }) => ({ area, role, perMatch: perMatchUnder(matches, set, cell, role), stars: heldStars(area, role) }));
    const fields = { playerCode, matches: matches.length, ratings, refreshedAt: now };
    if (row === null) await ctx.db.insert("playerRoleStars", fields);
    else await ctx.db.replace("playerRoleStars", row._id, fields);
  }
}
