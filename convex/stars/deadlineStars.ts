import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type QueryCtx } from "../_generated/server";
import { heldFixtures } from "../gameweekScorer/heldMatches";
import { namedCodes } from "../lineup/lineup";
import { lineupsInGameweek } from "../lineup/lineups";
import { positionsNow, type PositionsNow } from "../positions/playerPositions";
import type { Position } from "../positions/positionTables";
import { LEAGUES_READ_MOST, takeAllOrThrow } from "../shared/cappedRead";
import { logFailure } from "../shared/errors";
import { teamsOf } from "../shared/leagueAccess";
import { playerByCode } from "../shared/players";
import { readOnce } from "../shared/readOnce";
import { MOST_TEAMS } from "../leagues/leagueLimits";
import { statusOf } from "../stats/matchStats";
import { starsOfPlayers } from "./playerStars";
import type { RoleStars } from "./starsShape";

// Stars at the deadline (spec/05 Auto-subs; Craig, 1 Nov 2026): an auto-sub who comes on in his
// own area plays the role he had the most stars for when the lineup locked, so scoring the gameweek
// again never moves it. When a league's deadline is recorded (deadlineRecorder.ts), each team's
// bench as it stood then is kept with its stars.
//
// The same row keeps each man the lineup named, with his club and positions then (#1540): "a
// position change counts from each league's own deadline" (spec/06, When positions change), so
// scoring a begun gameweek reads him as he stood then (teamGameweek.ts), and a position lost or a
// club changed weeks later never re-works its auto-subs, nor gives him his new club's match in it.
//
// With no copy kept, a sub plays the slot's first role: a stable fallback, which no change of stars
// moves, and a man is read with his club and positions now. So it is for a gameweek locked before
// this was built, for a player who joined the lineup after the deadline (the copy names only those
// in it then), and for one whose keeping failed. A
// failed keeping is logged, and each recording after tries again (`keepMissing`) for the league's
// latest begun gameweek, until one of its matches locks: stars move only when a match locks or the
// scoring changes, so a copy kept before then is the deadline's.
//
// Cost: one row a team a gameweek, each holding its bench players' rated roles: a few kilobytes,
// growing with teams and gameweeks. Scoring a league's gameweek reads its teams' rows, one a team;
// a single team's card or Squad tab reads its own.

/** Each team's bench at the league's deadline for `gameweek`, kept with its stars. Kept once: a
 *  second call for the same gameweek changes nothing. Worked out whole before any is written, so a
 *  failure, logged, keeps none and the next recording tries again. */
export const storeLeague = internalMutation({
  args: { leagueId: v.id("leagues"), gameweek: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, gameweek }) => {
    if ((await keptRows(ctx, leagueId, gameweek)).length > 0) return null;
    let rows: Omit<Doc<"deadlineStars">, "_id" | "_creationTime">[];
    try {
      rows = [];
      const teamIds = (await teamsOf(ctx, leagueId)).map((team) => team._id);
      const playerNow = playerReader(ctx, await positionsNow(ctx, leagueId));
      for (const [teamId, held] of await lineupsInGameweek(ctx, leagueId, teamIds, gameweek)) {
        const stars = await starsOfPlayers(ctx, held.bench);
        const bench = held.bench.map((playerCode) => ({ playerCode, stars: stars.get(playerCode)!.filter((rating) => typeof rating.stars === "number") }));
        const players = await Promise.all(namedCodes(held).map(async (playerCode) => ({ playerCode, ...(await playerNow(playerCode)) })));
        rows.push({ leagueId, gameweek, teamId, bench, players });
      }
    } catch (error: unknown) {
      logFailure(`League ${leagueId}'s stars at gameweek ${gameweek}'s deadline weren't kept, so its auto-subs play the slot's first role until they are`, error);
      return null;
    }
    for (const row of rows) await ctx.db.insert("deadlineStars", row);
    return null;
  },
});

/** Asks again for each league's latest begun gameweek with no stars kept, while none of its matches
 *  has locked. Run by each recording of deadlines. */
export const keepMissing = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const leagues = await takeAllOrThrow(ctx.db.query("leagues"), LEAGUES_READ_MOST, `More than ${LEAGUES_READ_MOST} leagues are held, so some would keep no stars`);
    for (const league of leagues) {
      const latest = await ctx.db
        .query("passedDeadlines")
        .withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", league._id))
        .order("desc")
        .first();
      if (latest === null || (await keptRows(ctx, league._id, latest.gameweek)).length > 0) continue;
      if ((await teamsOf(ctx, league._id)).length === 0) continue;
      if (await anyLocked(ctx, latest.gameweek)) continue;
      await ctx.scheduler.runAfter(0, internal.stars.deadlineStars.storeLeague, { leagueId: league._id, gameweek: latest.gameweek });
    }
    return null;
  },
});

/** Whether any of the gameweek's matches has locked, after which stars may have moved. */
async function anyLocked(ctx: QueryCtx, gameweek: number): Promise<boolean> {
  for (const fixture of await heldFixtures(ctx, gameweek)) if ((await statusOf(ctx, fixture.code))?.state === "locked") return true;
  return false;
}

function keptRows(ctx: QueryCtx, leagueId: Id<"leagues">, gameweek: number, teamId?: Id<"teams">) {
  return takeAllOrThrow(
    ctx.db
      .query("deadlineStars")
      .withIndex("by_leagueId_and_gameweek_and_teamId", (q) =>
        teamId === undefined ? q.eq("leagueId", leagueId).eq("gameweek", gameweek) : q.eq("leagueId", leagueId).eq("gameweek", gameweek).eq("teamId", teamId),
      ),
    MOST_TEAMS,
    `More than ${MOST_TEAMS} teams hold stars kept at gameweek ${gameweek}'s deadline`,
  );
}

/** A man a lineup names, as scoring reads him: his club, null for one the football sync doesn't
 *  hold, and his positions. */
export interface LineupPlayer {
  clubCode: number | null;
  positions: Position[];
}

/** Each player's club and positions now, read once however often he is asked for. */
export function playerReader(ctx: QueryCtx, positionsOfNow: PositionsNow): (code: number) => Promise<LineupPlayer> {
  return readOnce(async (code: number): Promise<LineupPlayer> => {
    const held = await playerByCode(ctx, code);
    return { clubCode: held?.clubCode ?? null, positions: await positionsOfNow(code) };
  });
}

/** What a team's row keeps from the deadline: its bench players' stars, and each man its lineup
 *  named as he stood then (none in a row kept before #1540). */
export interface KeptAtDeadline {
  stars: ReadonlyMap<number, RoleStars[]>;
  players: ReadonlyMap<number, LineupPlayer>;
}

/** What each team's row keeps from the league's deadline for `gameweek`, or only `teamId`'s when
 *  given: none for a team with no copy kept. */
export async function keptAtDeadline(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  gameweek: number,
  teamId?: Id<"teams">,
): Promise<Map<Id<"teams">, KeptAtDeadline>> {
  const rows = await keptRows(ctx, leagueId, gameweek, teamId);
  return new Map(
    rows.map((row) => [
      row.teamId,
      {
        stars: new Map(row.bench.map(({ playerCode, stars }) => [playerCode, stars])),
        players: new Map((row.players ?? []).map(({ playerCode, clubCode, positions }) => [playerCode, { clubCode, positions }])),
      },
    ]),
  );
}
