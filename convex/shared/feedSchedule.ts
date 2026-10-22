import { HOUR_MS, MINUTE_MS } from "./time";

// How often each feed the app reads is run, and how long past that the feeds page (spec/15) calls
// it late: the app's own schedule, not a league's rule, so constants with one home. crons.ts runs
// each scheduled feed from here, so the page judges lateness by the schedule that actually runs.

/** The feeds, each a sync or tick with its own run table. */
export const FEEDS = ["football", "positions", "matchStats", "liveStats"] as const;
export type Feed = (typeof FEEDS)[number];

/** A run's interval, as `crons.interval` takes it. */
type Every = { readonly hours: number } | { readonly minutes: number };

/** A cron's interval, and how long past it a feed with no success is still on time: a run's own
 *  length, and the tick Convex skips while the one before it still runs. */
export type FeedSchedule = { readonly every: Every; readonly graceMs: number };

/** Null for a feed no cron runs yet (ARCHITECTURE.md): it can't be late, so the page says so. */
export const FEED_SCHEDULES = {
  // A run reads FPL in a minute or two.
  football: { every: { hours: 6 }, graceMs: 30 * MINUTE_MS },
  // Run by hand for now: spec/06 names no cadence.
  positions: null,
  // ARCHITECTURE.md suggests every 10 minutes; no cron runs it yet.
  matchStats: null,
  // A tick reading several matches can outrun its minute, and Convex skips the next while it runs.
  liveStats: { every: { minutes: 1 }, graceMs: 4 * MINUTE_MS },
} as const satisfies Record<Feed, FeedSchedule | null>;

/** How long a scheduled feed may go without a success before it is late. */
export function lateAfterMs({ every, graceMs }: FeedSchedule): number {
  const everyMs = "hours" in every ? every.hours * HOUR_MS : every.minutes * MINUTE_MS;
  return everyMs + graceMs;
}
