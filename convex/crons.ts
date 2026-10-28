import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { FEED_SCHEDULES } from "./shared/feedSchedule";
import { PRUNE_EVERY } from "./shared/syncRuns";

// The four timed jobs, the same on the live site and on development (spec/20, "Timed jobs").
const crons = cronJobs();
/** A sync's argument when its cron starts it, so its run row says so. */
const BY_CRON = { trigger: "cron" } as const;

// Why six hours is soon enough: ARCHITECTURE.md. Each run downloads FPL's ~1.8 MB bootstrap and
// reads every held row to compare, so running it more often costs bandwidth for nothing new.
crons.interval("football sync", FEED_SCHEDULES.football.every, internal.football.footballSync.run, BY_CRON);

// The live poller's tick (#28): every minute, a no-op outside match windows (ARCHITECTURE.md).
crons.interval("live stats tick", FEED_SCHEDULES.liveStats.every, internal.stats.liveStatsSync.tick, {});

// Late stats (#27): each match past full time and not yet locked, so one still unsettled when the
// live tick's window ends is still read, corrected and locked (spec/07).
crons.interval("late stats", FEED_SCHEDULES.matchStats.every, internal.stats.matchStatsSync.run, BY_CRON);

// Clearing old run logs (#146, admin/runLogs.ts), then old sign-in asks (signInLinks.ts).
crons.interval("prune run logs", PRUNE_EVERY, internal.admin.runLogs.prune, {});

export default crons;
