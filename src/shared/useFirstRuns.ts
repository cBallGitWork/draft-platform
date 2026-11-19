import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { clockHourOf } from "../../convex/home/homeAt";
import { firstRunsAt, type FirstRunOf, type HeldWaiverClock } from "../../convex/waivers/runsAhead";
import { useLastLoaded } from "./useLastLoaded";
import { useMinute } from "./useMinute";

/** The league's waiver clock for the screen's hour, and the screen's minute to judge it at;
 *  undefined while it loads. No read takes the minute (#2008): the small clock query takes only the
 *  hour and sends its times (convex/waivers/waiverClock.ts), and its last answer is held across the
 *  hour's turn, so a run time never flashes off (#1777). */
export function useWaiverClock(leagueId: Id<"leagues">): { clock: HeldWaiverClock; minute: number } | undefined {
  const minute = useMinute();
  const clock = useLastLoaded(useQuery(api.waivers.waiverClock.clockOf, { leagueId, hour: clockHourOf(minute) }), leagueId);
  return useMemo(() => (clock === undefined ? undefined : { clock, minute }), [clock, minute]);
}

/** The run that can first take a player a run may take from `claimableFrom` on, at the screen's
 *  minute, for the claims, Scouting's list and the player card (#1467); undefined while the runs'
 *  times load. */
export function useFirstRuns(leagueId: Id<"leagues">): FirstRunOf | undefined {
  const at = useWaiverClock(leagueId);
  return useMemo(() => (at === undefined ? undefined : firstRunsAt(at.clock, at.minute)), [at]);
}
