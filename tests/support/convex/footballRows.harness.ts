// The football rows the Convex tests hold: clubs, players with the positions set for them, and a
// whole match record, written once here so a new required field on clubs, players,
// playerPositions or playerMatchStats is added in one place, not in each test.

import type { WithoutSystemFields } from "convex/server";
import type { Doc } from "../../../convex/_generated/dataModel";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Position } from "../../../convex/positions/positionTables";

export type Club = WithoutSystemFields<Doc<"clubs">>;

export const ARSENAL: Club = { code: 3, name: "Arsenal", shortName: "ARS" };
export const CHELSEA: Club = { code: 8, name: "Chelsea", shortName: "CHE" };
export const COVENTRY: Club = { code: 9, name: "Coventry", shortName: "COV" };

/** A player as a test holds him: his players row, and the positions set for him. */
export type HeldPlayer = WithoutSystemFields<Doc<"players">> & { positions: Position[] };

export const SAKA: HeldPlayer = { code: 1001, name: "Saka", fullName: "Bukayo Saka", clubCode: ARSENAL.code, positions: ["W"] };

export const insertClubs = async (ctx: MutationCtx, clubs: readonly Club[]) => {
  for (const club of clubs) await ctx.db.insert("clubs", club);
};

/** Each player's row, and his positions as the admin set them, with no starts counted. */
export const insertPlayers = async (ctx: MutationCtx, players: readonly HeldPlayer[]) => {
  for (const { positions, ...player } of players) {
    await ctx.db.insert("players", player);
    await ctx.db.insert("playerPositions", { code: player.code, starts: [], approved: [], set: positions, removed: [] });
  }
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
