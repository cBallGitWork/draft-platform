import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { clockHourOf } from "../../../convex/home/homeAt";
import { firstRunsAt, type FirstRunOf } from "../../../convex/waivers/runsAhead";
import { useLastLoaded } from "../../shared/useLastLoaded";
import { useMinute } from "../../shared/useMinute";

/** The run that can first take a player a run may take from `claimableFrom` on, at the screen's
 *  minute, for the claims, Scouting's list and the player card (#1467); undefined while the runs'
 *  times load. No read takes the minute (#2008): the small clock query takes only the hour and
 *  sends its times (convex/waivers/waiverClock.ts), judged here at the minute, and its last answer
 *  is held across the hour's turn, so a run time never flashes off (#1777). */
export function useFirstRuns(leagueId: Id<"leagues">): FirstRunOf | undefined {
  const minute = useMinute();
  const times = useLastLoaded(useQuery(api.waivers.waiverClock.clockOf, { leagueId, hour: clockHourOf(minute) }), leagueId);
  return useMemo(() => (times === undefined ? undefined : firstRunsAt(times, minute)), [times, minute]);
}
