import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { playerPositionsNow, positionsNow } from "../positions/playerPositions";
import { lineLimitsOf } from "../rules/firstRules";
import { gameModeOf } from "../rules/gameMode";
import type { LeagueRules } from "../rules/leagueRulesShape";
import type { Line } from "../shared/lineNames";
import type { PlayerCode } from "../shared/players";
import { NOT_CLASSIC, type LineupMode, type PlayerPositions } from "./lineup";

// What checking a lineup reads of its players, for every caller that checks one: saving it, the
// first lineup, the auto team, the live check and scoring's auto-subs. Their positions, and the
// game mode it is judged in (lineup.ts `LineupMode`): a classic league's (spec/22, The lineup)
// carries each player's line and the league's line limits.

/** Each player's positions now in the league (spec/06), for picking a first lineup. */
export async function heldPositionsOf(ctx: QueryCtx, leagueId: Id<"leagues">, playerCodes: readonly number[]): Promise<PlayerPositions> {
  const positionsOfNow = await positionsNow(ctx, leagueId);
  return new Map(await Promise.all(playerCodes.map(async (playerCode) => [playerCode, await positionsOfNow(playerCode)] as const)));
}

/** The mode under `rules`, with each player's line as `lines` gives it: one with none is left out,
 *  so the check names him (`lineUnknown`). */
export function lineupModeOf(rules: Pick<LeagueRules, "format" | "classic" | "lineLimits">, lines: ReadonlyMap<PlayerCode, Line | null>): LineupMode {
  if (!gameModeOf(rules).classic) return NOT_CLASSIC;
  const known = [...lines].flatMap(([code, line]) => (line === null ? [] : [[code, line] as const]));
  return { classic: true, lines: new Map(known), lineLimits: lineLimitsOf(rules) };
}

/** The mode for a lineup naming `codes` under `rules`, each one's line as it is now in the league;
 *  read only for a classic league. */
export async function lineupModeIn(ctx: QueryCtx, leagueId: Id<"leagues">, rules: LeagueRules, codes: readonly PlayerCode[]): Promise<LineupMode> {
  if (!gameModeOf(rules).classic) return NOT_CLASSIC;
  const { lineOf } = await playerPositionsNow(ctx, leagueId);
  return lineupModeOf(rules, new Map(await Promise.all(codes.map(async (code) => [code, await lineOf(code)] as const))));
}
