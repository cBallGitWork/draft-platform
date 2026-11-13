import { useEffect, useState } from "react";
import { MINUTE_MS } from "../../convex/shared/time";

/** The start of the current minute, moving on at the next: the time a query that must judge the
 *  clock is asked at, as a query may not read it (why, in convex/admin/feeds.ts). Each timer sets
 *  the next, so one that fires before its minute is up (the clock put back) still ticks on (#1437). */
export function useMinute(): number {
  const [minute, setMinute] = useState(() => startOfMinute(Date.now()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      timer = setTimeout(() => {
        setMinute(startOfMinute(Date.now()));
        next();
      }, MINUTE_MS - (Date.now() % MINUTE_MS));
    };
    next();
    return () => clearTimeout(timer);
  }, []);
  return minute;
}

/** The moment itself, the screen redrawn each minute: for a screen judging a deadline or an expiry
 *  while it is open. Judged against the moment, not the minute's start, which would leave a passed
 *  deadline still open up to 59s past. */
export function useNowEachMinute(): number {
  useMinute();
  return Date.now();
}

function startOfMinute(at: number): number {
  return at - (at % MINUTE_MS);
}
