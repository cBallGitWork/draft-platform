import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Why six hours is soon enough: ARCHITECTURE.md. Each run downloads FPL's ~1.8 MB bootstrap and
// reads every held row to compare, so running it more often costs bandwidth for nothing new.
crons.interval("football sync", { hours: 6 }, internal.footballSync.run, { trigger: "cron" });

export default crons;
