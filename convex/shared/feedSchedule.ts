import { v } from "convex/values";
import { HOUR_MS, MINUTE_MS } from "./time";

// How often each feed the app reads is run, and how long past that the feeds page (spec/15) calls
// it late: the app's own schedule, not a league's rule, so constants with one home. crons.ts runs
// each scheduled feed from here, so the page judges lateness by the schedule that actually runs.

/** The feeds, each a sync or tick with its own run table. */
export const FEEDS = ["football", "positions", "matchStats", "liveStats"] as const;
export type Feed = (typeof FEEDS)[number];
/** A feed, as a function's argument or a saved field takes one. */
export const feedValidator = v.union(...FEEDS.map((feed) => v.literal(feed)));

/** What the feeds page and the admin's failure email call each feed, and where its data comes
 *  from: wording for Craig to change in the pull request. */
export const FEED_NAMES: Record<Feed, { name: string; source: string }> = {
  football: { name: "Clubs, players and fixtures", source: "FPL" },
  positions: { name: "Team sheets", source: "the Premier League" },
  matchStats: { name: "Match stats", source: "FPL and the Premier League" },
  liveStats: { name: "Live stats", source: "FPL and the Premier League, during matches" },
};

/** Each feed's run table: one row a run, newest last. */
export const FEED_RUN_TABLES = {
  football: "footballSyncs",
  positions: "positionsSyncs",
  matchStats: "matchStatsSyncs",
  liveStats: "liveStatsTicks",
} as const satisfies Record<Feed, string>;

/** A run's interval, as `crons.interval` takes it. */
export type Every = { readonly hours: number } | { readonly minutes: number };

/** A cron's interval, and how long past it a feed with no success is still on time: a run's own
 *  length, and the tick Convex skips while the one before it still runs. */
export type FeedSchedule = { readonly every: Every; readonly graceMs: number };

/** Null for a feed no cron runs (ARCHITECTURE.md): it can't be late, so the page says so. */
export const FEED_SCHEDULES = {
  // A run reads FPL in a minute or two.
  football: { every: { hours: 6 }, graceMs: 30 * MINUTE_MS },
  // Run by hand for now: spec/06 names no cadence.
  positions: null,
  // Late stats, every 10 minutes (spec/20). A run of ten due matches can take most of Convex's
  // 10-minute action limit, and Convex skips the next while it runs.
  matchStats: { every: { minutes: 10 }, graceMs: 10 * MINUTE_MS },
  // A tick reading several matches can outrun its minute, and Convex skips the next while it runs.
  liveStats: { every: { minutes: 1 }, graceMs: 4 * MINUTE_MS },
} as const satisfies Record<Feed, FeedSchedule | null>;

/** How long a scheduled feed may go without a success before it is late. */
export function lateAfterMs({ every, graceMs }: FeedSchedule): number {
  const everyMs = "hours" in every ? every.hours * HOUR_MS : every.minutes * MINUTE_MS;
  return everyMs + graceMs;
}
