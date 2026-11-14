import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, mutation, type MutationCtx } from "../_generated/server";
import { MATCH_OVERRIDES_MOST } from "../gameweekScorer/heldMatches";
import { recordEvent } from "../mail/letters";
import { matchWords } from "../mail/letterWords";
import { everyLeague, takeAllOrThrow } from "../shared/cappedRead";
import { fixtureByCode } from "../shared/fixtures";
import { adminOf, refuse } from "../shared/leagueAccess";
import { clubByCode, currentPlayersAt, lostPlayerName, playerByCode } from "../shared/players";
import { livePrintsOf } from "../stats/livePrints";
import { abandonedOf, matchRecordsOf } from "../stats/matchRecordReads";
import { askToStoreFinal, statusOf } from "../stats/matchStats";
import { reopenForRead } from "../stats/matchStatsDue";
import { queueRefresh } from "../stats/seasonPointsQueue";
import { countedStats, moveSeasonTotals } from "../stats/seasonStats";
import { rescoreGameweek } from "../table/finalScores";

// The admin marks a match abandoned, or takes the mark back (#904; spec/05 S05.6, S05.7, S05.46,
// S05.47). An abandoned match counts as never played: its records are deleted, and their stats
// taken off each man's season, and it is held locked with none, so every man in it reads as not
// having played and is auto-subbed, and its gameweek can still end; the feeds' reads of it write
// nothing while the mark stands (matchStats.ts, matchStatsDue.ts). Each league's overrides of men's
// points in it are deleted too, and every league with a player in it gets a Mail letter.
//
// Taking the mark back opens the match again, provisional and never read, so the next read of the
// feeds writes its records afresh; the overrides deleted with it stay deleted.

/** Why a mark was refused, as the admin is told it. */
export const abandonRefusals = {
  noMatch: "There's no such match this season.",
  notKickedOff: "That match hasn't kicked off, so it can't be abandoned.",
  alreadyMarked: "That match is already marked abandoned.",
  notMarked: "That match isn't marked abandoned.",
} as const;

/** The admin marks the match abandoned. */
export const mark = mutation({
  args: { fixtureCode: v.number() },
  returns: v.null(),
  handler: async (ctx, { fixtureCode }) => {
    const by = await adminOf(ctx);
    const fixture = await markable(ctx, fixtureCode);
    if ((await abandonedOf(ctx, fixtureCode)) !== null) refuse(abandonRefusals.alreadyMarked);
    const now = Date.now();
    await ctx.db.insert("abandonedMatches", { fixtureCode, by, at: now });
    const dropped = await dropRecords(ctx, fixtureCode);
    await lockUnplayed(ctx, fixtureCode, now);
    await tellLeagues(ctx, fixture, by, true, dropped);
    // Its gameweek may now be final, every other match in it locked (matchStats.ts).
    await askToStoreFinal(ctx, fixtureCode, { onlyIfGameweekFinal: true });
    return null;
  },
});

/** The admin takes the mark back: the match is read again from the feeds. */
export const unmark = mutation({
  args: { fixtureCode: v.number() },
  returns: v.null(),
  handler: async (ctx, { fixtureCode }) => {
    const by = await adminOf(ctx);
    const fixture = await markable(ctx, fixtureCode);
    const held = (await abandonedOf(ctx, fixtureCode)) ?? refuse(abandonRefusals.notMarked);
    await ctx.db.delete("abandonedMatches", held._id);
    await reopenForRead(ctx, fixtureCode);
    await tellLeagues(ctx, fixture, by, false, []);
    return null;
  },
});

/** The match, if it is this season's and has kicked off; refused otherwise. */
async function markable(ctx: MutationCtx, fixtureCode: number): Promise<Doc<"fixtures"> & { gameweek: number }> {
  const fixture = await fixtureByCode(ctx, fixtureCode);
  if (fixture === null || fixture.droppedAt !== undefined || fixture.gameweek === null) return refuse(abandonRefusals.noMatch);
  if (fixture.kickoff === null || fixture.kickoff > Date.now()) refuse(abandonRefusals.notKickedOff);
  return { ...fixture, gameweek: fixture.gameweek };
}

/** Deletes the match's records, taking what they added off each man's season totals and season
 *  points; returns whose they were. Records written live and counted nowhere yet (livePrints.ts)
 *  have nothing to take off. */
async function dropRecords(ctx: MutationCtx, fixtureCode: number): Promise<number[]> {
  const rows = await matchRecordsOf(ctx, fixtureCode, "its abandonment");
  for (const row of rows) await ctx.db.delete("playerMatchStats", row._id);
  const playerCodes = rows.map((row) => row.playerCode);
  const prints = await livePrintsOf(ctx, fixtureCode);
  if (prints !== null) {
    await ctx.db.delete("liveMatchPrints", prints._id);
    return playerCodes;
  }
  await moveSeasonTotals(
    ctx,
    rows.map((row) => ({ playerCode: row.playerCode, fixtureCode, before: countedStats(row), after: {} })),
  );
  await queueRefresh(ctx, playerCodes);
  return playerCodes;
}

/** Holds the match locked with no records: over, and final, with no one having played in it. */
async function lockUnplayed(ctx: MutationCtx, fixtureCode: number, now: number): Promise<void> {
  const status = await statusOf(ctx, fixtureCode);
  if (status === null) {
    await ctx.db.insert("matchStatsStatus", { fixtureCode, state: "locked", fullTimeAt: now, completeAt: now, lockedAt: now, lastReadAt: now });
    return;
  }
  await ctx.db.patch("matchStatsStatus", status._id, { state: "locked", completeAt: status.completeAt ?? now, lockedAt: status.lockedAt ?? now });
}

/** Schedules each league's share of the mark, or of taking it back, in its own transaction, so one
 *  league's fault leaves the rest (cappedRead.ts's scheduleEveryLeague, #1558). `dropped` names the
 *  men whose records the mark deleted; with the clubs' men now, they are the match's players. */
async function tellLeagues(ctx: MutationCtx, fixture: Doc<"fixtures"> & { gameweek: number }, by: string, abandoned: boolean, dropped: readonly number[]) {
  const [home, away] = await Promise.all([clubByCode(ctx, fixture.homeClubCode), clubByCode(ctx, fixture.awayClubCode)]);
  const clubMen = (await Promise.all([currentPlayersAt(ctx, fixture.homeClubCode), currentPlayersAt(ctx, fixture.awayClubCode)])).flat();
  const playerCodes = [...new Set([...dropped, ...clubMen.map((player) => player.code)])];
  const args = { fixtureCode: fixture.code, matchName: matchWords(home.name, away.name), gameweek: fixture.gameweek, by, abandoned, playerCodes };
  for (const league of await everyLeague(ctx, "so some would keep points from an abandoned match")) {
    await ctx.scheduler.runAfter(0, internal.match.abandonedMatches.inLeague, { leagueId: league._id, ...args });
  }
}

/** One league's share: on the mark, its overrides in the match deleted; its gameweek scored again;
 *  and, where a squad holds one of the match's players or an override went, a letter to the league. */
export const inLeague = internalMutation({
  args: {
    leagueId: v.id("leagues"),
    fixtureCode: v.number(),
    matchName: v.string(),
    gameweek: v.number(),
    by: v.string(),
    abandoned: v.boolean(),
    playerCodes: v.array(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { leagueId, fixtureCode, matchName, gameweek, by, abandoned, playerCodes }) => {
    const league = await ctx.db.get("leagues", leagueId);
    if (league === null) return null;
    const overridesRemoved = abandoned ? await dropOverrides(ctx, league, fixtureCode) : [];
    await rescoreGameweek(ctx, league, gameweek);
    if (overridesRemoved.length === 0 && !(await holdsAny(ctx, league, playerCodes))) return null;
    await recordEvent(ctx, leagueId, by, { kind: "matchAbandoned", fixtureCode, matchName, gameweek, abandoned, overridesRemoved });
    return null;
  },
});

/** Deletes the league's overrides of men's points in the match; returns each man's name. */
async function dropOverrides(ctx: MutationCtx, league: Doc<"leagues">, fixtureCode: number): Promise<string[]> {
  const rows = await takeAllOrThrow(
    ctx.db.query("pointsOverrides").withIndex("by_leagueId_and_fixtureCode_and_playerCode", (q) => q.eq("leagueId", league._id).eq("fixtureCode", fixtureCode)),
    MATCH_OVERRIDES_MOST,
    `League ${league._id} holds more than ${MATCH_OVERRIDES_MOST} overrides in match ${fixtureCode}, so some would outlive its abandonment`,
  );
  const names: string[] = [];
  for (const row of rows) {
    await ctx.db.delete("pointsOverrides", row._id);
    names.push((await playerByCode(ctx, row.playerCode))?.name ?? lostPlayerName(row.playerCode));
  }
  return names;
}

/** Whether a squad in the league holds any of the men. */
async function holdsAny(ctx: MutationCtx, league: Doc<"leagues">, playerCodes: readonly number[]): Promise<boolean> {
  for (const playerCode of playerCodes) {
    const held = await ctx.db
      .query("squadPlayers")
      .withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", league._id).eq("playerCode", playerCode))
      .first();
    if (held !== null) return true;
  }
  return false;
}
