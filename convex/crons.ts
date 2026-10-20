import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Every six hours. Nothing the sync holds moves during a match: what does move (a new signing, a
// player changing clubs, a match rescheduled and the deadline with it) is announced days ahead,
// so a quarter of a day is soon enough. Each run downloads FPL's ~1.8 MB bootstrap and reads
// every held row to compare, so running it more often costs bandwidth for nothing new.
crons.interval("football sync", { hours: 6 }, internal.footballSync.run, { trigger: "cron" });

export default crons;
