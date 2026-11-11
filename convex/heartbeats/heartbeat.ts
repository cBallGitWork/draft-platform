import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, type MutationCtx } from "../_generated/server";

// Each timed job in crons.ts pings Healthchecks.io when it finishes (docs/PLAN.md, "No
// monitoring": a dead scheduled job would otherwise go unseen). The ping is a heartbeat, not the
// job's outcome: a feed's failed read is already on its run row and in the admin's failure email;
// this tells Healthchecks the job ran at all, and whether it threw.

/** The deployment's setting holding the Healthchecks project's ping address, its ping key
 *  included (https://hc-ping.com/<ping key>). Unset, nothing pings. */
export const PING_URL_ENV = "HEALTHCHECKS_PING_URL";
/** What Healthchecks adds to a check's ping address to hear that a run failed. */
export const FAIL_SUFFIX = "/fail";
/** How long a ping may take before it's given up on, so a slow Healthchecks never holds a job. */
export const PING_TIMEOUT_MS = 10_000;
/** What the log says, before the error, when a ping didn't reach Healthchecks. */
export const PING_FAILED_LOG = "Healthchecks ping failed";

/** The trigger a sync's run carries when its cron starts it (crons.ts); a run by hand pings nothing. */
export const CRON_TRIGGER = "cron" as const;

/** Each timed job's check in Healthchecks, by its slug: the check Craig makes for it there. */
export const CHECK_SLUGS = {
  footballSync: "football-sync",
  liveStatsTick: "live-stats-tick",
  lateStats: "late-stats",
  pruneRunLogs: "prune-run-logs",
  waiverRuns: "waiver-runs",
  tradeOffers: "trade-offers",
  sportmonksSync: "sportmonks-sync",
  sportmonksLiveTick: "sportmonks-live-tick",
  positionsSync: "positions-sync",
  sportmonksPositions: "sportmonks-positions",
} as const;
export type Check = keyof typeof CHECK_SLUGS;
const checkValidator = v.union(...(Object.keys(CHECK_SLUGS) as Check[]).map((check) => v.literal(check)));

/** The address that tells Healthchecks `check` finished, or failed; null when none is set. */
export function pingUrl(check: Check, failed: boolean): string | null {
  const base = process.env[PING_URL_ENV];
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/${CHECK_SLUGS[check]}${failed ? FAIL_SUFFIX : ""}`;
}

/** Pings `check`; a ping that doesn't arrive is logged and never fails the job. */
async function ping(check: Check, failed: boolean): Promise<void> {
  const url = pingUrl(check, failed);
  if (url === null) return;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(PING_TIMEOUT_MS) });
    if (!response.ok) console.error(PING_FAILED_LOG, check, response.status);
  } catch (error) {
    console.error(PING_FAILED_LOG, check, error);
  }
}

/** For a job that is an action: runs `work`, then pings `check`, or its failure, with the error
 *  thrown on, if `work` threw. A feed's failed read that `work` catches itself (outcomeOf) is no
 *  throw, so it pings as finished: that failure is on the run row. A null check (a run by hand,
 *  not the cron) only runs `work`. */
export async function withHeartbeat<Result>(check: Check | null, work: () => Promise<Result>): Promise<Result> {
  if (check === null) return work();
  let result: Result;
  try {
    result = await work();
  } catch (error) {
    await ping(check, true);
    throw error;
  }
  await ping(check, false);
  return result;
}

/** For a job that is a mutation, which can't fetch: the ping is scheduled for once its writes
 *  commit, so a mutation that throws sends none, and Healthchecks sees the missed beat. A job run
 *  over several actions, each starting the next, schedules it from its last. */
export async function scheduleHeartbeat(ctx: Pick<MutationCtx, "scheduler">, check: Check): Promise<void> {
  if (pingUrl(check, false) === null) return;
  await ctx.scheduler.runAfter(0, internal.heartbeats.heartbeat.beat, { check });
}

/** The scheduled ping `scheduleHeartbeat` asks for. */
export const beat = internalAction({
  args: { check: checkValidator },
  returns: v.null(),
  handler: async (_ctx, { check }) => {
    await ping(check, false);
    return null;
  },
});
