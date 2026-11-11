import { useEffect, useState } from "react";
import { SECOND_MS } from "../../convex/shared/time";
import type { DraftState } from "./seam";
import { timeLeftWords } from "./words";

/** The clock of the pick on the clock, as the draft holds it. */
export type PickClock = Extract<DraftState, { status: "live" }>["clock"];

/** The pick on the clock: its number, its clock and its pick time, in seconds. */
export type OnTheClock = { pick: number; clock: PickClock; pickSeconds: number };

/** How long the pick on the clock has left at `now`: its full time while its clock waits to start,
 *  the 10 seconds after the pick before it, and frozen where the commissioner paused it. */
export function leftAt({ startsAt, endsAt, pausedAt }: PickClock, now: number): number {
  return endsAt - Math.max(pausedAt ?? now, startsAt);
}

/** The time the pick on the clock has left, counted down each second, standing still while the
 *  draft is paused. */
export function ClockLeft({ onTheClock: { clock } }: { onTheClock: OnTheClock }) {
  const now = useNowWhile(clock.pausedAt === undefined);
  return <span className="tabular-nums">{timeLeftWords(leftAt(clock, now))}</span>;
}

/** The 10 seconds the reader has to undo his own pick (#1458): they run until `until`, the next
 *  clock's start or the draft's end, frozen at `pausedAt` while the draft is paused. */
export type UndoWindow = { until: number; pausedAt?: number };

/** How long is left to undo the reader's pick, counted down each second; null with none, or once
 *  they are up. */
export function useUndoLeft(window: UndoWindow | null): number | null {
  const now = useNowWhile(window !== null && window.pausedAt === undefined);
  const left = window === null ? 0 : window.until - (window.pausedAt ?? now);
  return left > 0 ? left : null;
}

/** The time now, read again each second while `ticking`, and as it starts. */
function useNowWhile(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, SECOND_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [ticking]);
  return now;
}
