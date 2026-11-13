// Scouting's test league (#1694): Ann's team (or the managers a test names) in the test league,
// Arsenal and Chelsea, and the players a test holds, with each one's season totals as it says.

import type { Id } from "../../../convex/_generated/dataModel";
import type { MutationCtx } from "../../../convex/_generated/server";
import { FPL_SEASON } from "../recorded/plSeasons.payloads";
import { ARSENAL, CHELSEA, insertClubs, insertPlayers, type HeldPlayer } from "./footballRows.harness";
import { addManagers, adminCreatesLeague, ANN, type TestConvex } from "./leagues.harness";
import { fakeResend, signInDeployment } from "./signIn.harness";

/** A league with `managers`' teams, in that order, Arsenal and Chelsea, and `players` with the positions set for them. */
export async function scoutingLeague(
  players: readonly HeldPlayer[],
  managers: readonly string[] = [ANN],
): Promise<{ t: TestConvex; leagueId: Id<"leagues">; teams: Id<"teams">[] }> {
  const t = await signInDeployment();
  fakeResend();
  const leagueId = await adminCreatesLeague(t);
  const teams = await addManagers(t, leagueId, [...managers]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL, CHELSEA]);
    await insertPlayers(ctx, players);
  });
  return { t, leagueId, teams };
}

/** The player's season totals as the football sync holds them, this season unless `season` says. */
export const holdSeasonTotals = (ctx: MutationCtx, playerCode: number, stats: Record<string, number>, season = FPL_SEASON) =>
  ctx.db.insert("playerSeasonStats", { season, playerCode, stats });
