// The stars tests' shared players (#11): four strikers rated against each other on three final
// matches each, one with too few matches, one who never came on, and a centre-back alone in the
// defence, with their matches and the refresh run to its end.

import { vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { MutationCtx } from "../../../convex/_generated/server";
import { HOUR_MS } from "../../../convex/shared/time";
import { ARSENAL, CHELSEA, completeRecord, insertClubs, insertPlayers, type HeldPlayer } from "./footballRows.harness";
import type { TestConvex } from "./test.harness";

const striker = (code: number, name: string): HeldPlayer => ({ code, name, fullName: name, clubCode: ARSENAL.code, positions: ["ST"] });

/** Under the first scoring a striker gets 2 for 60 minutes or more, 1 for fewer, and 4 a goal. */
export const SCORER = striker(1101, "Scorer"); // 2 goals a match: 10 a match
export const STEADY = striker(1102, "Steady"); // 1 goal a match: 6
export const BLANK = striker(1103, "Blank"); // 90 minutes, no goal: 2
export const CAMEO = striker(1104, "Cameo"); // ten minutes off the bench: 1
export const NEWCOMER = striker(1105, "Newcomer"); // two matches only: "?"
export const UNUSED = striker(1106, "Unused"); // on the bench, never on: "—"
export const STOPPER: HeldPlayer = { code: 1107, name: "Stopper", fullName: "Stopper", clubCode: ARSENAL.code, positions: ["CB"] };
const STARS_PLAYERS = [SCORER, STEADY, BLANK, CAMEO, NEWCOMER, UNUSED, STOPPER];

/** Each held match: its code, and its kickoff an hour apart, the oldest first. */
const FIRST_KICKOFF = Date.parse("2026-09-12T14:00:00Z");
export const MATCHES = [501, 502, 503];
const kickoffOf = (index: number) => FIRST_KICKOFF + index * HOUR_MS;

/** A held match between the two clubs, kicked off `index` hours after the first. */
export const insertMatch = (ctx: MutationCtx, code: number, index: number) =>
  ctx.db.insert("fixtures", { code, gameweek: 1, homeClubCode: ARSENAL.code, awayClubCode: CHELSEA.code, kickoff: kickoffOf(index) });

/** His final record of a match. */
export const lockedRecord = (playerCode: number, fixtureCode: number, stats: Record<string, number>, parts: Parameters<typeof completeRecord>[3] = {}) => ({
  ...completeRecord(playerCode, fixtureCode, stats, parts),
  state: "locked" as const,
});

/** The players, the three matches and their final records. */
export async function holdStarsPlayers(t: TestConvex): Promise<void> {
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL, CHELSEA]);
    await insertPlayers(ctx, STARS_PLAYERS);
    for (const [index, fixtureCode] of MATCHES.entries()) {
      await insertMatch(ctx, fixtureCode, index);
      const records = [
        lockedRecord(SCORER.code, fixtureCode, { minutes: 90, goals_scored: 2 }),
        lockedRecord(STEADY.code, fixtureCode, { minutes: 90, goals_scored: 1 }),
        lockedRecord(BLANK.code, fixtureCode, { minutes: 90 }),
        lockedRecord(CAMEO.code, fixtureCode, { minutes: 10 }, { started: false }),
        lockedRecord(STOPPER.code, fixtureCode, { minutes: 90 }),
      ];
      if (index < 2) records.push(lockedRecord(NEWCOMER.code, fixtureCode, { minutes: 90 }));
      if (index === 0) records.push(lockedRecord(UNUSED.code, fixtureCode, {}, { started: false, played: false }));
      for (const record of records) await ctx.db.insert("playerMatchStats", record);
    }
  });
}

/** Runs every scheduled refresh to its end. */
export const refreshesRun = (t: TestConvex) => t.finishAllScheduledFunctions(() => vi.runAllTimers());

/** Every player's stars refreshed, page by page, and ranked. */
export async function refreshEveryone(t: TestConvex): Promise<void> {
  await t.mutation(internal.stars.starsRefresh.refreshAll, { cursor: null, startedAt: null });
  await refreshesRun(t);
}

/** Each player's held row, by his code. */
export const starsRows = async (t: TestConvex) =>
  new Map((await t.run((ctx) => ctx.db.query("playerRoleStars").collect())).map((row) => [row.playerCode, row] as const));

/** His stars for each role he holds a rating for, by area and role. */
export async function starsOf(t: TestConvex, playerCode: number): Promise<Map<string, unknown>> {
  const row = (await starsRows(t)).get(playerCode);
  return new Map((row?.ratings ?? []).map(({ area, role, stars }) => [`${area}/${role}`, stars]));
}
