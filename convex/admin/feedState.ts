import { v, type Infer } from "convex/values";
import { lateAfterMs, type FeedSchedule } from "../shared/feedSchedule";

// How the feeds page (spec/15) judges one feed from its runs: a feed that stops silently is the
// failure to catch, so one with no success for longer than its schedule allows is late.

/** Fine; late (no success for longer than its schedule allows); failing (its last run failed);
 *  not running yet (no run on record); not scheduled (runs only by hand, so it can't be late). */
export const feedState = v.union(
  v.literal("fine"),
  v.literal("late"),
  v.literal("failing"),
  v.literal("notRunningYet"),
  v.literal("notScheduled"),
);
export type FeedState = Infer<typeof feedState>;

/** A run's outcome as each run table records it: a sync or tick that reads matches lists each. */
export type RunOutcome = { ok: true; matches?: readonly ({ ok: true } | { ok: false; error: string })[] } | { ok: false; error: string };

/** Why a run failed, or null if it didn't. A run that read matches fails if any match failed: a
 *  feed refusing every match still leaves a run marked ok. */
export function failureOf(outcome: RunOutcome): string | null {
  if (!outcome.ok) return outcome.error;
  const failed = outcome.matches?.find((match) => !match.ok);
  return failed === undefined || failed.ok ? null : failed.error;
}

/** From when a feed owes a success: always, on a fixed schedule; only while a match is live, for
 *  the live tick, from its kickoff; or null, while it owes none. */
export const ALWAYS_OWED = Number.NEGATIVE_INFINITY;

export type FeedRuns = {
  /** The newest run's start, and why it failed; null with no run on record. */
  lastRun: { ranAt: number; failure: string | null } | null;
  lastSuccessAt: number | null;
};

export function judgeFeed(
  { lastRun, lastSuccessAt }: FeedRuns,
  schedule: FeedSchedule | null,
  owedSince: number | null,
  now: number,
): FeedState {
  if (lastRun !== null && lastRun.failure !== null) return "failing";
  if (schedule === null) return lastRun === null ? "notRunningYet" : "notScheduled";
  const since = owedSince === null ? null : Math.max(lastSuccessAt ?? owedSince, owedSince);
  if (since !== null && since !== ALWAYS_OWED && now - since > lateAfterMs(schedule)) return "late";
  return lastRun === null ? "notRunningYet" : "fine";
}
