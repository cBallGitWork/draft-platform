import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { keepDroppedDeadlines, recordPassedDeadlines } from "../gameweeks/deadlineRecorder";
import { repriceMatches } from "../stats/seasonPointsMoves";
import { rebuildIfNoneKept } from "../stats/seasonRebuilds";
import { putNewPlayersOnWaivers } from "../waivers/waiverPlayers";
import { keepScoutingPlayers } from "../scouting/scoutingPlayers";
import { followKickoffs } from "../scoring/patchKickoffs";

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

/** Players the feed stopped sending, marked dropped: each leaves Scouting's list with his row (#1559). */
export function afterPlayersDropped(ctx: MutationCtx, dropped: readonly number[]): Promise<void> {
  return keepScoutingPlayers(ctx, dropped);
}

/** Matches moved to another gameweek, sent again or dropped: their season points are repriced,
 *  and a waiting patch follows its gameweek's first kickoff, later or earlier (patchKickoffs.ts,
 *  #901, #1304). */
export async function afterMatchesMoved(ctx: MutationCtx, moved: readonly Fixture[]): Promise<void> {
  await repriceMatches(ctx, moved);
  await followKickoffs(ctx, Date.now());
}

/** After a batch of matches sent: as afterMatchesMoved, then the season's points rebuilt where
 *  none are kept yet. */
export async function afterMatchesSent(ctx: MutationCtx, moved: readonly Fixture[]): Promise<void> {
  await afterMatchesMoved(ctx, moved);
  await rebuildIfNoneKept(ctx);
}

/** This season's gameweeks the feed stopped sending, before they are marked: each keeps its last
 *  deadline (#202). */
export function beforeGameweeksDropped(ctx: MutationCtx, gameweeks: readonly number[]): Promise<number> {
  return keepDroppedDeadlines(ctx, gameweeks);
}
