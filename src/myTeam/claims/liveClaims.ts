import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../../convex/_generated/api";
import { clockHourOf } from "../../../convex/home/homeAt";
import { pendingClaimsAt, waiversAt } from "../../../convex/waivers/runsAhead";
import { refusalOf } from "../../shared/refusal";
import { useFirstRuns } from "../../shared/useFirstRuns";
import { useLastLoaded } from "../../shared/useLastLoaded";
import { useMinute } from "../../shared/useMinute";
import type { ClaimChanges, ClaimsSeam } from "./seam";
import { claimFailedWords } from "./words";

/** The claims' seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/waivers/waiverClaims.ts); any other failure is logged and said plainly. */
export const liveClaims: ClaimsSeam = {
  // The claims don't take the minute: the run that can first take each player is worked out here at
  // it (useFirstRuns.ts, #2008), so they are read again only when they change.
  usePendingClaims: function usePendingClaims(leagueId) {
    const held = useQuery(api.waivers.waiverClaims.pending, { leagueId });
    const firstRunOf = useFirstRuns(leagueId);
    return useMemo(() => (held === undefined || firstRunOf === undefined ? undefined : pendingClaimsAt(held, firstRunOf)), [held, firstRunOf]);
  },
  // Asked for the hour, never the minute (#2008): the next runs, the lock and the window move on with
  // the clock, so they are worked out here at the screen's minute (runsAhead.ts's `waiversAt`). The
  // last answer is held across the hour's turn, so the order never flashes off (#1777).
  useWaivers: function useWaivers(leagueId) {
    const minute = useMinute();
    const held = useLastLoaded(useQuery(api.waivers.waiverOrder.ofLeague, { leagueId, hour: clockHourOf(minute) }), leagueId);
    return useMemo(() => (held === undefined ? undefined : waiversAt(held, minute)), [held, minute]);
  },
  useClaimChanges: function useClaimChanges() {
    const rank = useMutation(api.waivers.waiverClaims.rank);
    const withdraw = useMutation(api.waivers.waiverClaims.withdraw);
    const changeDrop = useMutation(api.waivers.waiverClaims.changeDrop);
    return useMemo<ClaimChanges>(
      () => ({
        rank: (leagueId, claimIds) => refusalOf(() => rank({ leagueId, claimIds }), "Ranking waiver claims", claimFailedWords),
        withdraw: (leagueId, claimId) => refusalOf(() => withdraw({ leagueId, claimId }), "Withdrawing a waiver claim", claimFailedWords),
        changeDrop: (leagueId, claimId, dropCode) => refusalOf(() => changeDrop({ leagueId, claimId, dropCode }), "Changing a claim's drop", claimFailedWords),
      }),
      [rank, withdraw, changeDrop],
    );
  },
};
