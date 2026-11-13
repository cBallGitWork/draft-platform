import { api, internal } from "../../../convex/_generated/api";
import { inTenths } from "../../../convex/scoring/values";
import type { Id } from "../../../convex/_generated/dataModel";
import { pointsAt } from "../../../convex/playerCard/cardPoints";
import type { SlotPosition } from "../../../convex/lineup/pitch";
import type { PlayersSort } from "../../../convex/scouting/playersList";
import type { ScoringSet } from "../../../convex/scoring/scoringSet";
import { WEEK_MS } from "../../../convex/shared/time";
import { actingAs, addManagers, adminCreatesLeague, type TestConvex, ANN } from "./leagues.harness";
import { ARSENAL, CHELSEA, PALMER, RICE as SHARED_RICE, SAKA, completeRecord, insertClubs, insertPlayers, type HeldPlayer } from "./footballRows.harness";
import { BY_NAME, playersListed } from "./playersList.harness";
import { EXAMPLE_SET } from "./scoring.example";
import { holdExampleScoring } from "./siteScoring.harness";
import { fakeResend, signInDeployment } from "./signIn.harness";

// Season points' league (#525, seasonPoints.ts): Ann's team holds Saka; Rice and Palmer are free
// agents. Saka has two whole records this season, one last season's and one only FPL's part of;
// Rice and Palmer one each. The site plays EXAMPLE_SET, and nothing is priced until a test says.

export { SAKA };
/** Two positions in different areas, so they price a goal differently: his card opens on CB. */
export const RICE: HeldPlayer = { ...SHARED_RICE, positions: ["CM", "CB"] };
/** A free agent: his points show though no team holds him. */
export { PALMER };
export const ALL_CODES = [SAKA.code, RICE.code, PALMER.code];

export const KICKOFF = Date.parse("2026-08-22T14:00:00Z");
export const fixture = (code: number, gameweek: number | null) => ({ code, gameweek, homeClubCode: ARSENAL.code, awayClubCode: CHELSEA.code, kickoff: KICKOFF + code * WEEK_MS });
export const GW1 = fixture(1, 1);
export const GW2 = fixture(2, 2);
export const GW3 = fixture(3, 3);
/** Last season's, which the feed no longer sends. */
export const LAST_SEASON = { ...fixture(4, 30), kickoff: KICKOFF - 52 * WEEK_MS, droppedAt: KICKOFF };

export const SAKA_GW1 = { minutes: 90, goals_scored: 1 };
export const SAKA_GW2 = { minutes: 64, goals_scored: 2, assists: 1 };
export const RICE_GW1 = { minutes: 90, goals_scored: 1 };
export const PALMER_GW1 = { minutes: 90, assists: 2 };

export const record = (playerCode: number, fixtureCode: number, stats: Record<string, number>, pl = true) =>
  completeRecord(playerCode, fixtureCode, stats, { pl });

export interface PointsLeague {
  t: TestConvex;
  leagueId: Id<"leagues">;
}

export async function seasonPointsLeague(): Promise<PointsLeague> {
  const t = await signInDeployment();
  fakeResend();
  const leagueId = await adminCreatesLeague(t);
  const [annTeam] = await addManagers(t, leagueId, [ANN]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL, CHELSEA]);
    await insertPlayers(ctx, [SAKA, RICE, PALMER]);
    for (const each of [GW1, GW2, GW3, LAST_SEASON]) await ctx.db.insert("fixtures", each);
    await holdExampleScoring(ctx);
    await ctx.db.insert("squadPlayers", { leagueId, teamId: annTeam, playerCode: SAKA.code });
    for (const each of [
      record(SAKA.code, GW1.code, SAKA_GW1),
      record(SAKA.code, GW2.code, SAKA_GW2),
      record(SAKA.code, LAST_SEASON.code, { minutes: 90, goals_scored: 3 }),
      // Only FPL's part has arrived, so it isn't priced yet.
      record(SAKA.code, GW3.code, { minutes: 90, goals_scored: 4 }, false),
      record(RICE.code, GW1.code, RICE_GW1),
      record(PALMER.code, GW1.code, PALMER_GW1),
    ]) {
      await ctx.db.insert("playerMatchStats", each);
    }
  });
  return { t, leagueId };
}

/** Prices these players' rows now, as a queued refresh does. */
export const refresh = ({ t }: PointsLeague, playerCodes = ALL_CODES) => t.mutation(internal.stats.seasonPoints.refresh, { playerCodes });

/** Scouting's players list as Ann reads it in `leagueId`. */
export const list = async ({ t, leagueId }: PointsLeague, sort: PlayersSort = BY_NAME) => playersListed(await actingAs(t, ANN), leagueId, { sort });

/** Each listed player's season points, by his code. */
export const pointsListed = async (league: PointsLeague) => new Map((await list(league)).players.map((player) => [player.code, player.seasonPoints]));

/** His card's matches added up as Scouting adds them: each at the card's first position, or the
 *  league's override. */
export async function cardTotalOf({ t, leagueId }: PointsLeague, playerCode: number) {
  const card = (await (await actingAs(t, ANN)).query(api.playerCard.playerCard.card, { leagueId, playerCode, now: KICKOFF }))!;
  return inTenths(card.matches.reduce((total, match) => total + (match.override?.points ?? match.points[0].total ?? 0), 0));
}

/** His points in a match under `set` (EXAMPLE_SET unless given) at `position`. */
export const at = (stats: Record<string, number>, position: SlotPosition, set: ScoringSet = EXAMPLE_SET) => pointsAt(stats, set, position).total!;
