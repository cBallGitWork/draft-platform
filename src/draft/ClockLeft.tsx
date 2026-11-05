import { useEffect, useState } from "react";
import { SECOND_MS } from "../../convex/shared/time";
import type { DraftState } from "./seam";
import { timeLeftWords } from "./words";

/** The clock of the pick on the clock, as the draft holds it. */
export type PickClock = NonNullable<Extract<DraftState, { status: "live" }>["clock"]>;

/** The pick on the clock: its number, its clock (null in a draft started before #1091, until its
 *  next pick) and its pick time, in seconds, which its reading shows while it has no clock. */
export type OnTheClock = { pick: number; clock: PickClock | null; pickSeconds: number | null };

/** How long the pick on the clock has left at `now`: its full time while its clock waits to start,
 *  the 10 seconds after the pick before it, and frozen where the commissioner paused it. */
export function leftAt({ startsAt, endsAt, pausedAt }: PickClock, now: number): number {
  return endsAt - Math.max(pausedAt ?? now, startsAt);
}

/** The time the pick on the clock has left, counted down each second, standing still while the
 *  draft is paused; with no clock, its full pick time; with neither, nothing. */
export function ClockLeft({ onTheClock: { clock, pickSeconds } }: { onTheClock: OnTheClock }) {
  const [now, setNow] = useState(() => Date.now());
  const ticking = clock !== null && clock.pausedAt === undefined;
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setNow(Date.now()), SECOND_MS);
    return () => clearInterval(timer);
  }, [ticking]);
  const left = clock === null ? (pickSeconds === null ? null : pickSeconds * SECOND_MS) : leftAt(clock, now);
  return left === null ? null : <span className="tabular-nums">{timeLeftWords(left)}</span>;
}
