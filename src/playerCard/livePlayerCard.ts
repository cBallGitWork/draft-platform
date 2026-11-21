import { useMutation, useQuery } from "convex/react";
import { useCallback, useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { cardActionAt } from "../../convex/waivers/runsAhead";
import { answerOf, refusalOf } from "../shared/refusal";
import { useFirstRuns, useWaiverClock } from "../shared/useFirstRuns";
import { useLastLoaded } from "../shared/useLastLoaded";
import { liveScouts } from "../scouting/scouts/liveScouts";
import { liveShortlist } from "../scouting/shortlist/liveShortlist";
import type { PlayerCardSeam, WaiverChanges } from "./seam";
import { overrideFailedWords, removeOverrideFailedWords, waiverFailedWords } from "./words";

/** The player card's seam filled in by Convex. A refused change comes back as the server's own
 *  words (convex/table/pointsOverrides.ts, convex/waivers/); any other failure is logged and said
 *  plainly. */
export const livePlayerCard: PlayerCardSeam = {
  ...liveShortlist,
  ...liveScouts,
  // Held while the next minute's card loads, so a form open on it survives the minute's turn.
  usePlayerCard: function usePlayerCard(leagueId, playerCode, now) {
    return useLastLoaded(useQuery(api.playerCard.playerCard.card, { leagueId, playerCode, now }), `${leagueId}/${playerCode}`);
  },
  // The action doesn't take the minute: the run that can first take him is worked out here at it
  // (useFirstRuns.ts, #2008), so it is read again only when it changes.
  useCardAction: function useCardAction(leagueId, playerCode) {
    const held = useQuery(api.waivers.waivers.cardActionOn, { leagueId, playerCode });
    const at = useWaiverClock(leagueId);
    // Anything but a claim is shown at once; a claim waits for the runs' times.
    return useMemo(() => {
      if (held === undefined || held.kind !== "claim") return held;
      return at === undefined ? undefined : cardActionAt(held, at.clock, at.minute);
    }, [held, at]);
  },
  useReleased: function useReleased(leagueId, playerCode) {
    const state = useQuery(api.waivers.waivers.stateOf, { leagueId, playerCode });
    const firstRunOf = useFirstRuns(leagueId);
    return useMemo(() => {
      if (state === undefined) return undefined;
      if (state.kind !== "onWaivers") return null;
      return firstRunOf === undefined ? undefined : { firstRun: firstRunOf(state.claimableFrom) };
    }, [state, firstRunOf]);
  },
  usePositionRank: (leagueId, playerCode, position) =>
    useQuery(api.playerCard.positionRank.atPosition, position === null ? "skip" : { leagueId, playerCode, position }),
  useWaiverChanges: function useWaiverChanges() {
    const drop = useMutation(api.waivers.waivers.drop);
    const putIn = useMutation(api.waivers.waiverClaims.putIn);
    const withdraw = useMutation(api.waivers.waiverClaims.withdraw);
    const pickUp = useMutation(api.waivers.freeAgents.pickUp);
    return useMemo<WaiverChanges>(
      () => ({
        drop: (leagueId, playerCode) => refusalOf(() => drop({ leagueId, playerCode }), "Dropping a player", waiverFailedWords),
        claim: (leagueId, playerCode, dropCode) =>
          answerOf(async () => ({ claimId: await putIn({ leagueId, playerCode, dropCode }) }), "Claiming a player", waiverFailedWords),
        withdraw: (leagueId, claimId) => refusalOf(() => withdraw({ leagueId, claimId }), "Withdrawing a claim", waiverFailedWords),
        pickUp: (leagueId, playerCode, dropCode) => refusalOf(() => pickUp({ leagueId, playerCode, dropCode }), "Picking up a free agent", waiverFailedWords),
      }),
      [drop, putIn, withdraw, pickUp],
    );
  },
  useOverride: () => {
    const override = useMutation(api.table.pointsOverrides.override);
    return useCallback(
      (leagueId, change) => refusalOf(() => override({ leagueId, ...change }), "Overriding a player's points", overrideFailedWords),
      [override],
    );
  },
  useRemoveOverride: () => {
    const remove = useMutation(api.table.pointsOverrides.removeOverride);
    return useCallback(
      (leagueId, overridden) => refusalOf(() => remove({ leagueId, ...overridden }), "Removing a player's override", removeOverrideFailedWords),
      [remove],
    );
  },
};
