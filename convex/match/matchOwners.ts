// The team the match page names beside each man (#45, #561): the one his points are for. Once the
// gameweek has begun, that is the team whose lineup holds him, read against its squad at the
// deadline (lineups.ts), the lineups his points come from; so a man moved or released since names
// his old team: "Yes show the old team as for the current games he's on that team" (Craig, 31 Oct
// 2026). Before, it is the team that owns him now.

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { namedCodes } from "../lineup/lineup";
import { lineupsInGameweek } from "../lineup/lineups";
import { teamsOf } from "../shared/leagueAccess";
import { ownerOf } from "../squads/squadPlace";

type PlayerCode = number;

/** Each of `playerCodes` some team holds, by that team: at the deadline of `begunGameweek`, or now
 *  while it is null. */
export async function matchOwnersOf(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  begunGameweek: number | null,
  playerCodes: readonly PlayerCode[],
): Promise<Map<PlayerCode, Doc<"teams">>> {
  return begunGameweek === null ? ownersNowOf(ctx, leagueId, playerCodes) : deadlineOwnersOf(ctx, leagueId, begunGameweek, playerCodes);
}

async function ownersNowOf(ctx: QueryCtx, leagueId: Id<"leagues">, playerCodes: readonly PlayerCode[]): Promise<Map<PlayerCode, Doc<"teams">>> {
  const owner = await ownerOf(ctx, leagueId);
  const owners = new Map<PlayerCode, Doc<"teams">>();
  for (const playerCode of playerCodes) {
    const team = await owner(playerCode);
    if (team !== null) owners.set(playerCode, team);
  }
  return owners;
}

async function deadlineOwnersOf(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  gameweek: number,
  playerCodes: readonly PlayerCode[],
): Promise<Map<PlayerCode, Doc<"teams">>> {
  const teams = await teamsOf(ctx, leagueId);
  const lineups = await lineupsInGameweek(ctx, leagueId, teams.map((team) => team._id), gameweek);
  const inThisMatch = new Set(playerCodes);
  const owners = new Map<PlayerCode, Doc<"teams">>();
  for (const team of teams) {
    for (const playerCode of namedCodes(lineups.get(team._id)!)) {
      if (inThisMatch.has(playerCode)) owners.set(playerCode, team);
    }
  }
  return owners;
}
