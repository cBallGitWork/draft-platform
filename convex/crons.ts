import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { FEED_SCHEDULES } from "./shared/feedSchedule";

const crons = cronJobs();

// Why six hours is soon enough: ARCHITECTURE.md. Each run downloads FPL's ~1.8 MB bootstrap and
// reads every held row to compare, so running it more often costs bandwidth for nothing new.
crons.interval("football sync", FEED_SCHEDULES.football.every, internal.football.footballSync.run, { trigger: "cron" });

// The live poller's tick (#28): every minute, a no-op outside match windows (ARCHITECTURE.md).
crons.interval("live stats tick", FEED_SCHEDULES.liveStats.every, internal.stats.liveStatsSync.tick, {});

export default crons;
