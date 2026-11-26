import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { playerPositionsNow, positionsNow } from "../positions/playerPositions";
import { gameModeOf } from "../rules/gameMode";
import type { LeagueRules } from "../rules/leagueRulesShape";
import type { PlayerCode } from "../shared/players";
import { lineupModeOf, NOT_CLASSIC, type LineupMode, type PlayerPositions } from "./lineup";

// What checking a lineup reads of its players now: saving it, the first lineup, the auto team and
// the live check. Their positions, and the game mode it is judged in (lineup.ts `LineupMode`): a
// classic league's (spec/22, The lineup) carries each player's line and the league's line limits.
// Scoring reads them as the deadline kept them instead (stars/deadlineStars.ts).

/** Each player's positions now in the league (spec/06), for picking a first lineup. */
export async function heldPositionsOf(ctx: QueryCtx, leagueId: Id<"leagues">, playerCodes: readonly number[]): Promise<PlayerPositions> {
  const positionsOfNow = await positionsNow(ctx, leagueId);
  return new Map(await Promise.all(playerCodes.map(async (playerCode) => [playerCode, await positionsOfNow(playerCode)] as const)));
}

/** The mode for a lineup naming `codes` under `rules`, each one's line as it is now in the league;
 *  read only for a classic league. */
export async function lineupModeIn(ctx: QueryCtx, leagueId: Id<"leagues">, rules: LeagueRules, codes: readonly PlayerCode[]): Promise<LineupMode> {
  if (!gameModeOf(rules).classic) return NOT_CLASSIC;
  const { lineOf } = await playerPositionsNow(ctx, leagueId);
  return lineupModeOf(rules, new Map(await Promise.all(codes.map(async (code) => [code, await lineOf(code)] as const))));
}
