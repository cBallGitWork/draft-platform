import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { leagueOpens } from "../leagues/leagueOpens";
import { everyLeague } from "../shared/cappedRead";
import { cancelOffersHoldingLeavers } from "../trades/tradeClose";
import { withdrawClaimsForLeavers } from "../waivers/waiverClaims";
import { keepDroppedDeadlines, recordPassedDeadlines } from "../gameweeks/deadlineRecorder";
import { keepGameweekKickoffs } from "../gameweeks/gameweekKickoffs";
import { repriceMatches } from "../stats/seasonPointsMoves";
import { rebuildIfNoneKept } from "../stats/seasonRebuilds";
import { putNewPlayersOnWaivers } from "../waivers/waiverPlayers";
import { keepScoutingPlayers } from "../scouting/scoutingPlayers";
import { followKickoffs } from "../scoring/patchKickoffs";
import { checkEveryLeagueSoon } from "../leagues/leagueChecks";

// What runs after a football sync writes the site's players, matches and gameweeks: the deadlines,
// stats, scoring, waivers and Scouting that follow them (ARCHITECTURE.md "Where code lives", the
// server's layers). One home, so a feed adapter writing the site's tables calls these and never
// those features by name: footballSync.ts today, Sportmonks' sync once the switch lands (#1424).
// Each runs in the transaction that writes its rows.

type Fixture = Pick<Doc<"fixtures">, "code" | "kickoff">;

/** Before a sync writes or drops a match: a deadline that has passed is recorded, in the same
 *  transaction as the kickoffs that may move it (#150, deadlineRecorder.ts). */
export function beforeMatchesWritten(ctx: MutationCtx): Promise<number> {
  return recordPassedDeadlines(ctx);
}

/** Players sent, `newcomers` new or sent again after a gap (#1489): a newcomer goes on waivers in
 *  his row's transaction, so no league sees a free agent first (#1197), and every one sent,
 *  changed or not, keeps his Scouting row, so a player held from before Scouting's rows gets his
 *  (#1559). */
export async function afterPlayersSent(ctx: MutationCtx, newcomers: readonly number[], sent: readonly number[]): Promise<void> {
  await putNewPlayersOnWaivers(ctx, newcomers, Date.now());
  await keepScoutingPlayers(ctx, sent);
}

/** Players the feed stopped sending, marked dropped: each leaves Scouting's list with his row
 *  (#1559), and every league has its claims and trades for them ended, each league in its own
 *  transaction once the sync's has saved (`playersLeftIn`, #1558). */
export async function afterPlayersDropped(ctx: MutationCtx, dropped: readonly number[]): Promise<void> {
  await keepScoutingPlayers(ctx, dropped);
  if (dropped.length === 0) return;
  for (const league of await everyLeague(ctx, "so some would keep claims and trades for players who have left")) {
    await ctx.scheduler.runAfter(0, internal.football.afterFootballSync.playersLeftIn, { leagueId: league._id, playerCodes: [...dropped] });
  }
}

/** One league's share of players leaving the Premier League, sold abroad say (#2200): a pending
 *  claim for one is withdrawn, its manager told (S08.24), and a pending trade holding one, open or
 *  in review, is cancelled, both managers told (S08.25). A queue keeps him, greyed out, and
 *  auto-pick skips him (S04.21), so nothing is done to it here. A league deleted or frozen for
 *  deletion since is left alone, as its claims and offers are (#1493). */
export const playersLeftIn = internalMutation({
  args: { leagueId: v.id("leagues"), playerCodes: v.array(v.number()) },
  returns: v.null(),
  handler: async (ctx, { leagueId, playerCodes }) => {
    const league = await ctx.db.get("leagues", leagueId);
    if (league === null || !leagueOpens(league)) return null;
    const left = new Set(playerCodes);
    await withdrawClaimsForLeavers(ctx, league, left);
    await cancelOffersHoldingLeavers(ctx, leagueId, left);
    return null;
  },
});

/** Matches moved to another gameweek, sent again or dropped: their season points are repriced,
 *  and a waiting patch follows its gameweek's first kickoff, later or earlier (patchKickoffs.ts,
 *  #901, #1304). */
export async function afterMatchesMoved(ctx: MutationCtx, moved: readonly Fixture[]): Promise<void> {
  await repriceMatches(ctx, moved);
  await followKickoffs(ctx, Date.now());
  if (moved.length > 0) await afterKickoffsChanged(ctx);
}

/** A match new, moved, dropped or with a new kickoff can move any league's deadlines: every
 *  league's waivers and offers are looked at again on the crons' next pass (#1998). */
export function afterKickoffsChanged(ctx: MutationCtx): Promise<void> {
  return checkEveryLeagueSoon(ctx);
}

/** After a batch of matches sent: first, before anything reads a deadline, the gameweeks whose
 *  matches it added, moved or re-timed (`touched`, where each was and is) keep their first and last
 *  kickoffs (gameweekKickoffs.ts, #2009); then as afterMatchesMoved, and the season's points
 *  rebuilt where none are kept yet. */
export async function afterMatchesSent(ctx: MutationCtx, moved: readonly Fixture[], touched: Iterable<number | null>): Promise<void> {
  await keepGameweekKickoffs(ctx, touched);
  await afterMatchesMoved(ctx, moved);
  await rebuildIfNoneKept(ctx);
}

/** After a page of matches marked dropped: their gameweeks keep their first and last kickoffs
 *  without them, then as afterMatchesMoved. */
export async function afterMatchesDropped(ctx: MutationCtx, dropped: readonly Doc<"fixtures">[]): Promise<void> {
  await keepGameweekKickoffs(ctx, dropped.map(({ gameweek }) => gameweek));
  await afterMatchesMoved(ctx, dropped);
}

/** This season's gameweeks the feed stopped sending, before they are marked: each keeps its last
 *  deadline (#202). */
export function beforeGameweeksDropped(ctx: MutationCtx, gameweeks: readonly number[]): Promise<number> {
  return keepDroppedDeadlines(ctx, gameweeks);
}
