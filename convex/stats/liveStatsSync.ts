import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, type ActionCtx } from "../_generated/server";
import { logFailure } from "../shared/errors";
import { syncDue } from "./matchStatsSync";
import { delayCommentary } from "../football/matchCommentary";
import { readFplPayloads } from "../football/fpl/fpl";
import { syncTeamSheets } from "../football/matchTeamSheets";
import { recordSideMatches, type SideMatches } from "../admin/sideRuns";
import type { liveStatsTickFields } from "../schema";
import type { DueMatch } from "../shared/dueMatches";

// Issue #28: the live poller's tick, run every minute by `crons.ts`. Outside every match window
// it reads no feed and writes nothing; inside one, it reads each live match as `matchStatsSync`
// does, and keeps its score and clock fresh (#49, football/matchScores.ts) and its commentary
// (#43, football/matchCommentary.ts); and in the hour before each kickoff it reads the match's
// team sheets alone (#45, football/matchTeamSheets.ts). Why a cron, and how a failed tick is
// caught up: ARCHITECTURE.md.

type Outcome = Infer<typeof liveStatsTickFields.outcome>;

export const tick = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const ranAt = Date.now();
    // FPL read at most once a tick, by whichever of the two reads needs it first.
    let read: ReturnType<typeof readFplPayloads> | undefined;
    const fpl = () => (read ??= readFplPayloads());
    await tickLive(ctx, ranAt, fpl);
    // After the live matches and apart from them: it never throws, and is on its own feed's row.
    await syncTeamSheets(ctx, ranAt, fpl);
    return null;
  },
});

/** Each live match read, and the tick's row, then its side reads' rows (#522): its team stats and
 *  threshold steps, owed while a match is live; no read and no row while none is. A tick that
 *  read no match, whole or match by match, leaves those two without a row, so they show late
 *  beside its failure (#824), rather than emailing it three times. */
async function tickLive(ctx: ActionCtx, ranAt: number, fpl: typeof readFplPayloads): Promise<void> {
  let outcome: Outcome;
  let live: DueMatch[] = [];
  let sides: SideMatches | null = null;
  let anyMatchRead = false;
  try {
    live = await ctx.runQuery(internal.stats.liveStats.live, { now: ranAt });
    if (live.length === 0) return;
    const read = await syncDue(ctx, live, ranAt, "live", fpl);
    outcome = { ok: true, matches: read.matches, scores: read.scores };
    sides = read.sides;
    anyMatchRead = read.matches.some((match) => match.ok);
  } catch (error: unknown) {
    outcome = { ok: false, error: logFailure("live stats tick failed", error) };
    // A tick that read nothing read no commentary either: each live match's is delayed (#43).
    await delayCommentary(ctx, live.map(({ fixtureCode }) => fixtureCode), outcome.error, ranAt);
  }
  await ctx.runMutation(internal.stats.liveStats.recordTick, { ranAt, outcome });
  if (sides !== null && anyMatchRead) await recordSideMatches(ctx, ranAt, sides, true);
}
