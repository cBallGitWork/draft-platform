import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../../convex/_generated/api";
import { refusalOf } from "../../shared/refusal";
import { useMinute } from "../../shared/useMinute";
import type { ClaimChanges, ClaimsSeam } from "./seam";
import { claimFailedWords } from "./words";

/** The claims' seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/waivers/waiverClaims.ts); any other failure is logged and said plainly. */
export const liveClaims: ClaimsSeam = {
  usePendingClaims: (leagueId) => useQuery(api.waivers.waiverClaims.pending, { leagueId }),
  // Asked at the screen's minute, as a query may not read the clock: the next runs move on with it.
  useWaivers: (leagueId) => useQuery(api.waivers.waiverOrder.ofLeague, { leagueId, now: useMinute() }),
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
