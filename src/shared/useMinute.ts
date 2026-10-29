import { useEffect, useState } from "react";
import { MINUTE_MS } from "../../convex/shared/time";

/** The start of the current minute, moving on at the next: the time a query that must judge the
 *  clock is asked at, as a query may not read it (why, in convex/admin/feeds.ts). */
export function useMinute(): number {
  const [minute, setMinute] = useState(() => startOfMinute(Date.now()));
  useEffect(() => {
    const timer = setTimeout(() => setMinute(startOfMinute(Date.now())), minute + MINUTE_MS - Date.now());
    return () => clearTimeout(timer);
  }, [minute]);
  return minute;
}

function startOfMinute(at: number): number {
  return at - (at % MINUTE_MS);
}
