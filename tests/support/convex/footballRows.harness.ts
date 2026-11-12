// The football rows the Convex tests hold: clubs, players with the positions set for them, a player
// who has left the Premier League, and a whole match record, written once here so a new required field on clubs, players,
// playerPositions or playerMatchStats is added in one place, not in each test. Only a positions
// test, whose row's starts, approvals or PL label are what it tests, writes that row in full.

import type { WithoutSystemFields } from "convex/server";
import type { Doc } from "../../../convex/_generated/dataModel";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Position } from "../../../convex/positions/positionTables";

export type Club = WithoutSystemFields<Doc<"clubs">>;

/** How many gameweeks the tests' Premier League season holds. The app reads a season's count from
 *  its gameweek rows (seasonGameweeks.ts's `seasonGameweekCount`; #1618), never a constant. */
export const PL_GAMEWEEKS = 38;

/** The season's gameweek rows, 1 to `count`, as the football sync holds them, for a test that holds
 *  only a few matches: the season has however many gameweeks it holds (#1618). Their FPL deadlines
 *  are feed data no league reads, so they are left at 0. */
export const insertSeasonGameweeks = async (ctx: MutationCtx, count = PL_GAMEWEEKS) => {
  for (let number = 1; number <= count; number += 1) await ctx.db.insert("gameweeks", { number, deadline: 0 });
};

export const ARSENAL: Club = { code: 3, name: "Arsenal", shortName: "ARS" };
export const CHELSEA: Club = { code: 8, name: "Chelsea", shortName: "CHE" };
export const COVENTRY: Club = { code: 9, name: "Coventry", shortName: "COV" };

/** A player as a test holds him: his players row, and the positions set for him. */
export type HeldPlayer = WithoutSystemFields<Doc<"players">> & { positions: Position[] };

export const SAKA: HeldPlayer = { code: 1001, name: "Saka", fullName: "Bukayo Saka", clubCode: ARSENAL.code, positions: ["W"] };

export const insertClubs = async (ctx: MutationCtx, clubs: readonly Club[]) => {
  for (const club of clubs) await ctx.db.insert("clubs", club);
};

/** A player's positions as the admin set them, with no starts counted, for a test whose players
 *  row is written already or not needed. */
export const insertSetPositions = (ctx: MutationCtx, code: number, positions: Position[]) =>
  ctx.db.insert("playerPositions", { code, starts: [], approved: [], set: positions, removed: [] });

/** Each player's row, and his positions as the admin set them, with no starts counted. */
export const insertPlayers = async (ctx: MutationCtx, players: readonly HeldPlayer[]) => {
  for (const { positions, ...player } of players) {
    await ctx.db.insert("players", player);
    await insertSetPositions(ctx, player.code, positions);
  }
};

/** A player's row as a test writes it, before he leaves the Premier League. */
export type PlayerRow = Omit<WithoutSystemFields<Doc<"players">>, "droppedAt">;

/** A code the football sync holds no player for (#323). */
export const UNHELD = 9999;

/** A match the match-stats sync read at full time and locked, all at `at`. */
export const insertLockedStatus = (ctx: MutationCtx, fixtureCode: number, at: number) =>
  ctx.db.insert("matchStatsStatus", { fixtureCode, state: "locked", fullTimeAt: at, lockedAt: at, lastReadAt: at });

/** A player who has left the Premier League: a players row only, no positions. */
export const GONE: PlayerRow = { code: 2001, name: "Gone", fullName: "Long Gone", clubCode: ARSENAL.code };

/** `player`'s row, dropped at `droppedAt`, with no playerPositions row: positions are only set for
 *  someone still in the league. */
export const insertDroppedPlayer = async (ctx: MutationCtx, player: PlayerRow, droppedAt: number) => {
  await ctx.db.insert("players", { ...player, droppedAt });
};

/** A match record both feeds' parts are in, of a player who started and played, unless `parts` says. */
export const completeRecord = (
  playerCode: number,
  fixtureCode: number,
  stats: Record<string, number>,
  parts: { started?: boolean; played?: boolean | null; pl?: boolean } = {},
) => ({
  playerCode,
  fixtureCode,
  started: parts.started ?? true,
  played: parts.played === undefined ? true : parts.played,
  arrived: { fpl: true, pl: parts.pl ?? true },
  stats,
  state: "complete" as const,
});
