// The seam for the Transactions tab's waiver claims, the waiver order and the runs (#1200): what
// they read and ask. Convex fills it in live (liveClaims.ts); the preview and the tests hand the
// screen their own. League settings' Waivers tab reads the waiver order through it too.

import type { Id } from "../../../convex/_generated/dataModel";
import type { PendingClaim } from "../../../convex/waivers/waiverClaims";
import type { WaiversView } from "../../../convex/waivers/waiverOrder";
import type { Change } from "../../shared/refusal";

export type { PendingClaim, WaiversView };

/** The changes a manager makes to his pending claims, each resolving with null once made or the
 *  words why not. */
export type ClaimChanges = {
  /** All his claims' ids, first first. */
  rank(leagueId: Id<"leagues">, claimIds: Id<"waiverClaims">[]): Change;
  withdraw(leagueId: Id<"leagues">, claimId: Id<"waiverClaims">): Change;
  /** Who goes if it succeeds, or null for nobody; the claim keeps its rank. */
  changeDrop(leagueId: Id<"leagues">, claimId: Id<"waiverClaims">, dropCode: number | null): Change;
};

export type ClaimsSeam = {
  /** The caller's pending claims, or every team's for whoever runs the league, live (a hook):
   *  undefined while they load. */
  usePendingClaims(leagueId: Id<"leagues">): PendingClaim[] | undefined;
  /** The league's waiver order, runs and window, live (a hook): undefined while it loads. */
  useWaivers(leagueId: Id<"leagues">): WaiversView | undefined;
  /** The changes to his claims (a hook). */
  useClaimChanges(): ClaimChanges;
};
