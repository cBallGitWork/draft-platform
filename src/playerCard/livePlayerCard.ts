import { useMutation, useQuery } from "convex/react";
import { useCallback, useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { refusalOf } from "../shared/refusal";
import { liveShortlist } from "../scouting/shortlist/liveShortlist";
import type { PlayerCardSeam, WaiverChanges } from "./seam";
import { overrideFailedWords, waiverFailedWords } from "./words";

/** The player card's seam filled in by Convex. A refused change comes back as the server's own
 *  words (convex/table/pointsOverrides.ts, convex/waivers/); any other failure is logged and said
 *  plainly. */
export const livePlayerCard: PlayerCardSeam = {
  ...liveShortlist,
  usePlayerCard: (leagueId, playerCode, now) => useQuery(api.playerCard.playerCard.card, { leagueId, playerCode, now }),
  useCardAction: (leagueId, playerCode) => useQuery(api.waivers.waivers.cardActionOn, { leagueId, playerCode }),
  useWaiverChanges: function useWaiverChanges() {
    const drop = useMutation(api.waivers.waivers.drop);
    const putIn = useMutation(api.waivers.waiverClaims.putIn);
    const pickUp = useMutation(api.waivers.freeAgents.pickUp);
    return useMemo<WaiverChanges>(
      () => ({
        drop: (leagueId, playerCode) => refusalOf(() => drop({ leagueId, playerCode }), "Dropping a player", waiverFailedWords),
        claim: (leagueId, playerCode, dropCode) => refusalOf(() => putIn({ leagueId, playerCode, dropCode }), "Claiming a player", waiverFailedWords),
        pickUp: (leagueId, playerCode, dropCode) => refusalOf(() => pickUp({ leagueId, playerCode, dropCode }), "Picking up a free agent", waiverFailedWords),
      }),
      [drop, putIn, pickUp],
    );
  },
  useOverride: () => {
    const override = useMutation(api.table.pointsOverrides.override);
    return useCallback(
      (leagueId, change) => refusalOf(() => override({ leagueId, ...change }), "Overriding a player's points", overrideFailedWords),
      [override],
    );
  },
};
