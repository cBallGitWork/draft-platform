import { v, type Infer } from "convex/values";
import { begunBy, isLocked, latestBegun, type LeagueDeadlines } from "../gameweeks/deadline";
import { gameweekDeadline } from "../gameweeks/nextGameweek";
import { waiverRulesShape, type LeagueRules } from "../rules/leagueRulesShape";
import { HOUR_MS } from "../shared/time";
import type { HeldPendingClaim, PendingClaim } from "./waiverClaims";
import type { CardAction, HeldCardAction } from "./waivers";
import { firstRunFrom } from "./waiverTimes";

// The waiver runs still to come, and whether each may fall in a gameweek's lock (#1467, #1488).
// A query taking the minute runs again, uncached, every minute for every open screen (#2008), so
// `clockOf` (waiverClock.ts) sends the times for an hour, and Scouting, Claims and the player card
// judge them at their own minute here (`firstRunsAt`), asking for the hour as league home does
// (../home/homeAt.ts's `clockHourOf`). Pure, so the screens and the server alike.

/** A waiver run still to come, with the gameweek whose lock it may fall in, and so may be skipped, or null
 *  when it surely won't. */
export const runAhead = v.object({ at: v.number(), skippedIf: v.union(v.number(), v.null()) });
export type RunAhead = Infer<typeof runAhead>;

/** The gameweek whose lock a run at `at` may fall in, seen from `now`, or null when it surely
 *  doesn't (#1488): the latest gameweek begun by `at`, unless that one had begun by `now` and isn't
 *  `underWay` (the gameweek under way now, null outside the lock), as its last match is then over.
 *  When a gameweek's last match ends isn't known ahead, so a later one's run is only "may" (Craig,
 *  11 Nov 2026: "skipped if GW12 is still on"). */
export function mayFallInLock(deadlines: LeagueDeadlines, underWay: number | null, now: number, at: number): number | null {
  const gameweek = latestBegun(deadlines, at);
  if (gameweek === null) return null;
  return isLocked(deadlines.get(gameweek) ?? null, now) && gameweek !== underWay ? null : gameweek;
}

/** The run that can first take a player a run may take from `claimableFrom` on, seen from `now`
 *  (#1467): never one already gone, as a run that passed him by was skipped; null with no runs.
 *  Where it may fall in a gameweek's lock, `skippedIf` names that gameweek: the run that takes him
 *  is then the first after its last match, which isn't known ahead (Craig, 11 Nov 2026: "after
 *  GW12's last match"), and every later run up to the next deadline is "may" too, so the claims
 *  one run will try together share it. */
export function firstRunTaking(runs: LeagueRules["waivers"]["runs"], deadlines: LeagueDeadlines, underWay: number | null, claimableFrom: number, now: number): RunAhead | null {
  const at = firstRunFrom(runs, Math.max(claimableFrom, now));
  return at === null ? null : { at, skippedIf: mayFallInLock(deadlines, underWay, now, at) };
}

/** What `clockOf` sends for any minute of its hour: the league's runs under its latest rules, its
 *  deadlines (null where none is known), and which of the gameweeks that can be the latest begun in
 *  that hour (`lockCandidates`) have a match not yet over (waiverLock.ts's `inWaiverLock`). */
export const heldWaiverClock = v.object({
  runs: waiverRulesShape.fields.runs,
  gameweeks: v.array(gameweekDeadline),
  underWay: v.array(v.number()),
});
export type HeldWaiverClock = Infer<typeof heldWaiverClock>;

/** The gameweeks that can be the latest begun at some minute of the hour starting at `hour`: the
 *  latest begun at its start, and every one begun after it by the hour's end. */
export function lockCandidates(deadlines: LeagueDeadlines, hour: number): number[] {
  const atStart = latestBegun(deadlines, hour);
  return begunBy(deadlines, hour + HOUR_MS).filter((gameweek) => atStart === null || gameweek >= atStart);
}

/** The run that can first take a player a run may take from `claimableFrom` on. */
export type FirstRunOf = (claimableFrom: number) => RunAhead | null;

/** `firstRunTaking` at `now`, from `clockOf`'s times. */
export function firstRunsAt({ runs, gameweeks, underWay }: HeldWaiverClock, now: number): FirstRunOf {
  const deadlines: LeagueDeadlines = new Map(gameweeks.map(({ gameweek, deadline }) => [gameweek, deadline]));
  const latest = latestBegun(deadlines, now);
  const underWayNow = latest !== null && underWay.includes(latest) ? latest : null;
  return (claimableFrom) => firstRunTaking(runs, deadlines, underWayNow, claimableFrom, now);
}

/** The pending claims as the screens show them, each with the run that can first take its player. */
export function pendingClaimsAt(held: readonly HeldPendingClaim[], firstRunOf: FirstRunOf): PendingClaim[] {
  return held.map(({ claimableFrom, ...claim }) => ({ ...claim, run: claimableFrom === null ? null : firstRunOf(claimableFrom) }));
}

/** The player card's action as the screens show it: a claim with the run that can first take him. */
export function cardActionAt(held: HeldCardAction, firstRunOf: FirstRunOf): CardAction {
  if (held.kind !== "claim") return held;
  const { claimableFrom, ...claim } = held;
  return { ...claim, firstRun: firstRunOf(claimableFrom) };
}
