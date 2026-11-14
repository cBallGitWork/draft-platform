import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type ActionCtx, type MutationCtx, type QueryCtx } from "../_generated/server";
import { liveTickFeed } from "../schema";
import { timedJobsOn } from "../heartbeats/heartbeat";
import { everyMs, FEED_SCHEDULES } from "../shared/feedSchedule";
import { LINEUPS_OUT_BEFORE_KICKOFF_MS } from "../shared/time";
import { liveMatches } from "./liveStats";
import { dueSheetsAt } from "../football/matchTeamSheets";
import { sportmonksLiveMatches } from "../football/sportmonks/sportmonksLive";
import { competitionsHeld } from "../football/sportmonks/sportmonksSync";
import { sportmonksToken } from "../football/sportmonks/sportmonks";

// The live ticks run only near matches (#1999, the Convex quota): no cron every minute, but a chain.
// Each tick schedules the next a minute on while it had a match to read, and otherwise sleeps until
// the next one's window opens: FPL's an hour before kickoff, for the team sheets (#45), Sportmonks'
// at kickoff. A tick that throws still schedules its next. The six-hourly syncs, and late stats every
// 10 minutes, arm it: so a moved kickoff is picked up, and a chain that died (a tick killed before
// it could schedule) starts again within 10 minutes. One row a feed holds its next run, so arming
// never starts a second chain. Each runs only where its feed does: FPL's where timed jobs are on
// (#1997), Sportmonks' where its token is set.

type LiveTickFeed = Infer<typeof liveTickFeed>;

interface Chain {
  /** Whether the feed runs on this deployment. */
  on: () => boolean;
  /** Whether a match is due a read at `now`. */
  busy: (ctx: QueryCtx, now: number) => Promise<boolean>;
  /** When the next match's window opens, after `now`; null with none held. */
  nextOpens: (ctx: QueryCtx, now: number) => Promise<number | null>;
}

const CHAINS: Record<LiveTickFeed, Chain> = {
  liveStats: {
    on: timedJobsOn,
    busy: async (ctx, now) => (await liveMatches(ctx, now)).length > 0 || (await dueSheetsAt(ctx, now)).length > 0,
    nextOpens: async (ctx, now) => {
      const upcoming = ctx.db.query("fixtures").withIndex("by_kickoff", (q) => q.gt("kickoff", now));
      for await (const { kickoff, gameweek, droppedAt } of upcoming) {
        if (droppedAt === undefined && gameweek !== null && kickoff !== null) return kickoff - LINEUPS_OUT_BEFORE_KICKOFF_MS;
      }
      return null;
    },
  },
  sportmonksLive: {
    on: () => sportmonksToken() !== null,
    busy: async (ctx, now) => (await sportmonksLiveMatches(ctx, now)).length > 0,
    nextOpens: async (ctx, now) => {
      const on = new Set((await competitionsHeld(ctx)).filter((each) => each.on).map(({ competition }) => competition));
      const upcoming = ctx.db.query("sportmonksFixtures").withIndex("by_kickoff", (q) => q.gt("kickoff", now));
      for await (const { kickoff, droppedAt, competition } of upcoming) {
        if (droppedAt === undefined && kickoff !== null && competition !== undefined && on.has(competition)) return kickoff;
      }
      return null;
    },
  },
};

/** Every feed with a live tick chain, for the late-stats run that restarts one that died. */
export const LIVE_TICK_FEEDS = Object.keys(CHAINS) as LiveTickFeed[];

/** Each feed's tick, as the chain schedules it. */
const TICKS = {
  liveStats: internal.stats.liveStatsSync.tick,
  sportmonksLive: internal.football.sportmonks.sportmonksLive.tick,
} as const;

/** How long a busy tick waits before the next: the live tick's minute. */
const TICK_EVERY_MS = everyMs(FEED_SCHEDULES.liveStats.every);

/** Schedules `feed`'s next tick. From a sync (`ranTick` false), a tick already running or due no
 *  later is left alone; from the tick itself, `busy` says whether it had a match to read, or is
 *  null when it threw before it knew, and is worked out here. */
export async function arrangeTick(ctx: MutationCtx, feed: LiveTickFeed, ranTick: boolean, busy: boolean | null = null): Promise<void> {
  const chain = CHAINS[feed];
  if (!chain.on()) return;
  const held = await ctx.db
    .query("liveTickChains")
    .withIndex("by_feed", (q) => q.eq("feed", feed))
    .unique();
  const job = held === null ? null : await ctx.db.system.get("_scheduled_functions", held.scheduledId);
  if (!ranTick && job?.state.kind === "inProgress") return;
  const now = Date.now();
  const at = (busy ?? (await chain.busy(ctx, now))) ? now + TICK_EVERY_MS : await chain.nextOpens(ctx, now);
  if (job?.state.kind === "pending") {
    if (at !== null && job.scheduledTime <= at) return;
    await ctx.scheduler.cancel(job._id);
  }
  if (at === null) {
    if (held !== null) await ctx.db.delete("liveTickChains", held._id);
    return;
  }
  const scheduledId = await ctx.scheduler.runAt(at, TICKS[feed], {});
  if (held === null) await ctx.db.insert("liveTickChains", { feed, scheduledId });
  else await ctx.db.patch("liveTickChains", held._id, { scheduledId });
}

/** `arrangeTick`, for an action: a tick at its end, or Sportmonks' six-hourly sync. */
export const arrange = internalMutation({
  args: { feed: liveTickFeed, ranTick: v.boolean(), busy: v.union(v.boolean(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { feed, ranTick, busy }) => {
    await arrangeTick(ctx, feed, ranTick, busy);
    return null;
  },
});

/** Runs a tick's `work`, which says whether it had a match to read (null when it couldn't ask), then
 *  schedules its next, even when `work` threw. */
export async function chainedTick(ctx: ActionCtx, feed: LiveTickFeed, work: () => Promise<boolean | null>): Promise<null> {
  let busy: boolean | null = null;
  try {
    busy = await work();
  } finally {
    await ctx.runMutation(internal.stats.liveTicks.arrange, { feed, ranTick: true, busy });
  }
  return null;
}
