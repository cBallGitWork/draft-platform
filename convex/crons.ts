import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { CRON_TRIGGER } from "./heartbeats/heartbeat";
import { LEAD_WAKE_CRON } from "./heartbeats/leadWake";
import { FEED_SCHEDULES } from "./shared/feedSchedule";
import { DAILY_RUN_UTC_HOURS } from "./positions/positionsSync";
import { PRUNE_EVERY } from "./shared/syncRuns";
import { OFFER_CHECK_EVERY } from "./trades/tradeClose";
import { WAIVER_CHECK_EVERY } from "./waivers/waiverRun";

// The seven timed jobs, the same on the live site and on development (spec/20, "Timed jobs"), and the
// build pipeline's wake-up for the lead, the last below.
const crons = cronJobs();
/** A sync's argument when its cron starts it, so its run row says so. */
const BY_CRON = { trigger: CRON_TRIGGER } as const;

// Why six hours is soon enough: ARCHITECTURE.md. Each run downloads FPL's ~1.8 MB bootstrap and
// reads every held row to compare, so running it more often costs bandwidth for nothing new.
crons.interval("football sync", FEED_SCHEDULES.football.every, internal.football.footballSync.run, BY_CRON);

// The live poller's tick (#28): every minute, a no-op outside match windows (ARCHITECTURE.md).
crons.interval("live stats tick", FEED_SCHEDULES.liveStats.every, internal.stats.liveStatsSync.tick, {});

// Late stats (#27): each match past full time and not yet locked, so one still unsettled when the
// live tick's window ends is still read, corrected and locked (spec/07).
crons.interval("late stats", FEED_SCHEDULES.matchStats.every, internal.stats.matchStatsSync.run, BY_CRON);

// Waiver runs (#1198, spec/08): each league's at its own run times, UK time (waiverRun.ts).
crons.interval("waiver runs", WAIVER_CHECK_EVERY, internal.waivers.waiverRun.runDue, {});

// Trade offers (#383, spec/08): each open offer closes at the next deadline, when the trade
// deadline passes or a break starts (tradeClose.ts).
crons.interval("trade offers", OFFER_CHECK_EVERY, internal.trades.tradeClose.closeDue, {});

// The positions sync (#1194, spec/06): daily at 06:00 UK time, whatever the clocks (positionsSync.ts).
crons.cron("positions sync", `0 ${DAILY_RUN_UTC_HOURS.join(",")} * * *`, internal.positions.positionsSync.daily, {});

// Clearing old run logs (#146, admin/runLogs.ts), then old sign-in asks (signInLinks.ts).
crons.interval("prune run logs", PRUNE_EVERY, internal.admin.runLogs.prune, {});

// Sportmonks' reads (#1391, #1414): each competition that is on, on the football sync's six hours,
// and each of its matches every minute from kickoff to full time. Only where SPORTMONKS_API_TOKEN is set; each
// reads nothing where it isn't (football/sportmonks/).
crons.interval("sportmonks sync", FEED_SCHEDULES.sportmonks.every, internal.football.sportmonks.sportmonksSync.run, BY_CRON);
crons.interval("sportmonks live tick", FEED_SCHEDULES.sportmonksLive.every, internal.football.sportmonks.sportmonksLive.tick, {});
// And the Scottish Premiership's lineups, for positions (#1419), at the positions sync's 06:00 UK time.
crons.cron("sportmonks positions", `0 ${DAILY_RUN_UTC_HOURS.join(",")} * * *`, internal.football.sportmonks.sportmonksPositionsSync.daily, {});

// Not one of spec/20's jobs but the build pipeline's: wakes the lead every half hour, since GitHub's
// schedule drops its passes (heartbeats/leadWake.ts). Only where its token is set: the development deployment, never the live one.
crons.cron("wake the lead", LEAD_WAKE_CRON, internal.heartbeats.leadWake.wake, {});

export default crons;
