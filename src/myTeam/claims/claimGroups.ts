import type { Id } from "../../../convex/_generated/dataModel";
import type { PendingClaim } from "./seam";

// A team's pending claims as the Transactions tab shows them (#1200; the waivers picture): grouped
// by the run that can first take each player, soonest first, ranked within each run in the team's
// order, since a run can only take the players it clears. A run that may fall in a gameweek's lock
// isn't known to be the one: the run after its last match is, so every claim whose first run may
// fall in that lock is in one group, the claims one run will try together (#1467). Pure.

export type RunGroup = { run: PendingClaim["run"]; claims: PendingClaim[] };

/** Which group a claim, or a group, is: the run it waits on, by the gameweek whose last match it
 *  waits for when it may be skipped, else by its time. */
export const groupOf = ({ run }: Pick<RunGroup, "run">) => (run === null ? "none" : run.skippedIf !== null ? `after ${run.skippedIf}` : `at ${run.at}`);

/** The claims by run, soonest first, the claims with no run last; each run's in their order. */
export function byRun(claims: readonly PendingClaim[]): RunGroup[] {
  const groups = new Map<string, RunGroup>();
  for (const claim of claims) {
    const group = groups.get(groupOf(claim));
    if (group === undefined) groups.set(groupOf(claim), { run: claim.run, claims: [claim] });
    else group.claims.push(claim);
  }
  return [...groups.values()].sort((one, other) => (one.run?.at ?? Infinity) - (other.run?.at ?? Infinity));
}

/** The rank in its run of the earlier claim there that drops the same player as the claim at
 *  `index`, or null: the claim fails if that one wins. */
export function clashOf(group: RunGroup, index: number): number | null {
  const dropCode = group.claims[index].drop?.playerCode;
  if (dropCode === undefined) return null;
  const earlier = group.claims.slice(0, index).findIndex((claim) => claim.drop?.playerCode === dropCode);
  return earlier === -1 ? null : earlier + 1;
}

const idsOf = (claims: readonly PendingClaim[]) => claims.map(({ claimId }) => claimId);

/** Every claim's id in the team's order with `claimId` swapped with its neighbour in its run, up
 *  (-1) or down (1), or null where it has none that way. */
export function movedBy(claims: readonly PendingClaim[], claimId: Id<"waiverClaims">, step: -1 | 1): Id<"waiverClaims">[] | null {
  const at = claims.findIndex((claim) => claim.claimId === claimId);
  if (at === -1) return null;
  const inRun = (index: number) => groupOf(claims[index]) === groupOf(claims[at]);
  let other = at + step;
  while (other >= 0 && other < claims.length && !inRun(other)) other += step;
  if (other < 0 || other >= claims.length) return null;
  const ids = idsOf(claims);
  [ids[at], ids[other]] = [ids[other], ids[at]];
  return ids;
}

/** Every claim's id in the team's order with `claimId` dropped onto `targetId`'s place in their
 *  run, or null where they are in different runs or the same claim. */
export function movedOnto(claims: readonly PendingClaim[], claimId: Id<"waiverClaims">, targetId: Id<"waiverClaims">): Id<"waiverClaims">[] | null {
  const from = claims.findIndex((claim) => claim.claimId === claimId);
  const to = claims.findIndex((claim) => claim.claimId === targetId);
  if (from === -1 || to === -1 || from === to || groupOf(claims[from]) !== groupOf(claims[to])) return null;
  const ids = idsOf(claims);
  ids.splice(from, 1);
  ids.splice(to, 0, claimId);
  return ids;
}
